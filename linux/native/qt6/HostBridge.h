#pragma once

#include <QImage>
#include <QNetworkAccessManager>
#include <QObject>
#include <QUrl>
#include <QVariantList>
#include <QVariantMap>
#include <functional>

/**
 * Soft Silver Qt host ↔ Python sidecar bridge (`dogsc edit --port 47321`).
 *
 * Owns discovery of projects, scrub thumbs, and recording status so the Qt
 * shell can drive the ffmpeg sidecar without embedding capture itself.
 */
class HostBridge : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QUrl baseUrl READ baseUrl WRITE setBaseUrl NOTIFY baseUrlChanged)
    Q_PROPERTY(bool connected READ connected NOTIFY connectedChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(QVariantList projects READ projects NOTIFY projectsChanged)
    Q_PROPERTY(QString projectId READ projectId NOTIFY projectChanged)
    Q_PROPERTY(QString projectName READ projectName NOTIFY projectChanged)
    Q_PROPERTY(qreal duration READ duration NOTIFY projectChanged)
    Q_PROPERTY(QString mediaPath READ mediaPath NOTIFY projectChanged)
    Q_PROPERTY(qreal playhead READ playhead WRITE setPlayhead NOTIFY playheadChanged)
    Q_PROPERTY(QVariantMap recordStatus READ recordStatus NOTIFY recordStatusChanged)

public:
    explicit HostBridge(QObject *parent = nullptr);

    QUrl baseUrl() const { return m_baseUrl; }
    void setBaseUrl(const QUrl &url);

    bool connected() const { return m_connected; }
    QString status() const { return m_status; }
    QVariantList projects() const { return m_projects; }
    QString projectId() const { return m_projectId; }
    QString projectName() const { return m_projectName; }
    qreal duration() const { return m_duration; }
    QString mediaPath() const { return m_mediaPath; }
    qreal playhead() const { return m_playhead; }
    void setPlayhead(qreal seconds);
    QVariantMap recordStatus() const { return m_recordStatus; }

public slots:
    void refresh();
    void openProject(const QString &id);
    void openFirstProject();
    void requestThumb(qreal seconds);
    void refreshRecordStatus();
    void startRecord();
    void stopRecord();
    void pauseRecord();
    void resumeRecord();

signals:
    void baseUrlChanged();
    void connectedChanged();
    void statusChanged();
    void projectsChanged();
    void projectChanged();
    void playheadChanged();
    void recordStatusChanged();
    void thumbReady(const QImage &image, qreal seconds);
    void error(const QString &message);

private:
    void setConnected(bool connected);
    void setStatus(const QString &status);
    QUrl api(const QString &path) const;
    void getJson(const QUrl &url,
                 const std::function<void(const QJsonDocument &)> &ok);
    void postJson(const QUrl &url, const QJsonObject &body,
                  const std::function<void(const QJsonDocument &)> &ok);

    QNetworkAccessManager m_nam;
    QUrl m_baseUrl = QUrl(QStringLiteral("http://127.0.0.1:47321"));
    bool m_connected = false;
    QString m_status = QStringLiteral("idle");
    QVariantList m_projects;
    QString m_projectId;
    QString m_projectName;
    qreal m_duration = 0;
    QString m_mediaPath;
    qreal m_playhead = 0;
    QVariantMap m_recordStatus;
};
