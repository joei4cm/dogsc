#include "HostBridge.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QStandardPaths>
#include <QUrlQuery>

HostBridge::HostBridge(QObject *parent)
    : QObject(parent)
{
}

void HostBridge::setBaseUrl(const QUrl &url)
{
    if (m_baseUrl == url)
        return;
    m_baseUrl = url;
    emit baseUrlChanged();
}

void HostBridge::setPlayhead(qreal seconds)
{
    seconds = qMax(0.0, seconds);
    if (m_duration > 0)
        seconds = qMin(seconds, m_duration);
    if (qAbs(m_playhead - seconds) < 0.0005)
        return;
    m_playhead = seconds;
    emit playheadChanged();
    if (!m_projectId.isEmpty())
        requestThumb(m_playhead);
}

QUrl HostBridge::api(const QString &path) const
{
    QUrl url = m_baseUrl;
    url.setPath(path);
    return url;
}

void HostBridge::setConnected(bool connected)
{
    if (m_connected == connected)
        return;
    m_connected = connected;
    emit connectedChanged();
}

void HostBridge::setStatus(const QString &status)
{
    if (m_status == status)
        return;
    m_status = status;
    emit statusChanged();
}

void HostBridge::getJson(const QUrl &url, const std::function<void(const QJsonDocument &)> &ok)
{
    QNetworkRequest req(url);
    req.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("DogSC-QtHost/0.4"));
    QNetworkReply *reply = m_nam.get(req);
    connect(reply, &QNetworkReply::finished, this, [this, reply, ok]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            setConnected(false);
            setStatus(QStringLiteral("error"));
            emit error(reply->errorString());
            return;
        }
        const QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
        if (doc.isNull()) {
            setStatus(QStringLiteral("bad-json"));
            emit error(QStringLiteral("sidecar returned invalid JSON"));
            return;
        }
        setConnected(true);
        ok(doc);
    });
}

void HostBridge::postJson(const QUrl &url, const QJsonObject &body,
                          const std::function<void(const QJsonDocument &)> &ok)
{
    QNetworkRequest req(url);
    req.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("DogSC-QtHost/0.4"));
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    QNetworkReply *reply = m_nam.post(req, QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, ok]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            emit error(reply->errorString());
            return;
        }
        const QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
        ok(doc);
    });
}

void HostBridge::refresh()
{
    setStatus(QStringLiteral("refresh"));
    getJson(api(QStringLiteral("/api/projects")), [this](const QJsonDocument &doc) {
        QVariantList list;
        QJsonArray items;
        if (doc.isArray()) {
            items = doc.array();
        } else if (doc.isObject()) {
            const QJsonObject obj = doc.object();
            items = obj.value(QStringLiteral("projects")).toArray();
            if (items.isEmpty())
                items = obj.value(QStringLiteral("items")).toArray();
        }
        for (const QJsonValue &v : items) {
            if (v.isObject())
                list.append(v.toObject().toVariantMap());
            else if (v.isString())
                list.append(QVariantMap{{QStringLiteral("id"), v.toString()}});
        }
        m_projects = list;
        emit projectsChanged();
        setStatus(QStringLiteral("ready"));
        refreshRecordStatus();
        if (m_projectId.isEmpty() && !m_projects.isEmpty())
            openFirstProject();
    });
}

void HostBridge::openFirstProject()
{
    if (m_projects.isEmpty())
        return;
    const QVariantMap first = m_projects.first().toMap();
    const QString id = first.value(QStringLiteral("id")).toString();
    if (!id.isEmpty())
        openProject(id);
}

void HostBridge::openProject(const QString &id)
{
    if (id.isEmpty())
        return;
    setStatus(QStringLiteral("open"));
    getJson(api(QStringLiteral("/api/projects/%1").arg(id)), [this, id](const QJsonDocument &doc) {
        QJsonObject project = doc.object();
        if (project.contains(QStringLiteral("project"))
            && project.value(QStringLiteral("project")).isObject()) {
            project = project.value(QStringLiteral("project")).toObject();
        }

        m_projectId = project.value(QStringLiteral("id")).toString(id);
        m_projectName = project.value(QStringLiteral("name")).toString(m_projectId);
        const QJsonObject media = project.value(QStringLiteral("media")).toObject();
        m_duration = project.value(QStringLiteral("duration")).toDouble(
            media.value(QStringLiteral("duration")).toDouble());

        m_mediaPath = project.value(QStringLiteral("media_path")).toString();
        if (m_mediaPath.isEmpty()) {
            const QString home = QStandardPaths::writableLocation(QStandardPaths::HomeLocation);
            m_mediaPath = home + QStringLiteral("/.local/share/dogsc/projects/")
                + m_projectId + QStringLiteral("/media.mp4");
        }

        m_playhead = 0;
        emit projectChanged();
        emit playheadChanged();
        setStatus(QStringLiteral("ready"));
        requestThumb(0);
    });
}

void HostBridge::requestThumb(qreal seconds)
{
    if (m_projectId.isEmpty())
        return;
    seconds = qMax(0.0, seconds);
    QUrl url = api(QStringLiteral("/api/projects/%1/thumb").arg(m_projectId));
    QUrlQuery query;
    query.addQueryItem(QStringLiteral("t"), QString::number(seconds, 'f', 3));
    url.setQuery(query);

    QNetworkRequest req(url);
    req.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("DogSC-QtHost/0.4"));
    QNetworkReply *reply = m_nam.get(req);
    connect(reply, &QNetworkReply::finished, this, [this, reply, seconds]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            emit error(reply->errorString());
            return;
        }
        const QByteArray bytes = reply->readAll();
        QImage image;
        if (!image.loadFromData(bytes, "JPEG"))
            image.loadFromData(bytes);
        if (image.isNull()) {
            emit error(QStringLiteral("thumb decode failed"));
            return;
        }
        emit thumbReady(image.convertToFormat(QImage::Format_RGBA8888), seconds);
    });
}

void HostBridge::refreshRecordStatus()
{
    getJson(api(QStringLiteral("/api/record")), [this](const QJsonDocument &doc) {
        if (doc.isObject())
            m_recordStatus = doc.object().toVariantMap();
        else
            m_recordStatus = {};
        emit recordStatusChanged();
    });
}

void HostBridge::startRecord()
{
    postJson(api(QStringLiteral("/api/record/start")), QJsonObject{},
             [this](const QJsonDocument &doc) {
                 if (doc.isObject())
                     m_recordStatus = doc.object().toVariantMap();
                 emit recordStatusChanged();
                 setStatus(QStringLiteral("recording"));
             });
}

void HostBridge::stopRecord()
{
    postJson(api(QStringLiteral("/api/record/stop")), QJsonObject{},
             [this](const QJsonDocument &doc) {
                 if (doc.isObject())
                     m_recordStatus = doc.object().toVariantMap();
                 emit recordStatusChanged();
                 setStatus(QStringLiteral("ready"));
                 refresh();
             });
}

void HostBridge::pauseRecord()
{
    postJson(api(QStringLiteral("/api/record/pause")), QJsonObject{},
             [this](const QJsonDocument &) { refreshRecordStatus(); });
}

void HostBridge::resumeRecord()
{
    postJson(api(QStringLiteral("/api/record/resume")), QJsonObject{},
             [this](const QJsonDocument &) { refreshRecordStatus(); });
}
