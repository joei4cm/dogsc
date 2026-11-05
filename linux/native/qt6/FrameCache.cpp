#include "FrameCache.h"
#include "DecodePool.h"

#include <QProcess>
#include <QSet>
#include <QtConcurrent>
#include <QtMath>

FrameDecodeWorker::FrameDecodeWorker(QObject *parent)
    : QObject(parent)
{
}

void FrameDecodeWorker::decode(const QString &path, qlonglong key, qreal seconds,
                               int width, int height)
{
    QImage empty;
    if (path.isEmpty() || width <= 0 || height <= 0) {
        emit finished(key, empty);
        return;
    }
    QProcess ff;
    ff.setProgram(QStringLiteral("ffmpeg"));
    ff.setArguments({
        QStringLiteral("-hide_banner"), QStringLiteral("-loglevel"), QStringLiteral("error"),
        QStringLiteral("-ss"), QString::number(seconds, 'f', 3),
        QStringLiteral("-i"), path,
        QStringLiteral("-frames:v"), QStringLiteral("1"),
        QStringLiteral("-f"), QStringLiteral("rawvideo"),
        QStringLiteral("-pix_fmt"), QStringLiteral("rgba"),
        QStringLiteral("-s"), QStringLiteral("%1x%2").arg(width).arg(height),
        QStringLiteral("pipe:1"),
    });
    ff.setProcessChannelMode(QProcess::SeparateChannels);
    ff.start();
    if (!ff.waitForFinished(6000) || ff.exitCode() != 0) {
        emit finished(key, empty);
        return;
    }
    const QByteArray rgba = ff.readAllStandardOutput();
    const int expect = width * height * 4;
    if (rgba.size() < expect) {
        emit finished(key, empty);
        return;
    }
    QImage img(reinterpret_cast<const uchar *>(rgba.constData()),
               width, height, width * 4, QImage::Format_RGBA8888);
    emit finished(key, img.copy());
}

FrameCache::FrameCache(QObject *parent)
    : QObject(parent)
    , m_pool(new DecodePool(2, this))
{
    connect(m_pool, &DecodePool::finished, this, [this](qlonglong key, const QImage &image) {
        onDecoded(key, image);
    });
}

FrameCache::~FrameCache() = default;

QString FrameCache::mediaPath() const
{
    QMutexLocker lock(&m_mutex);
    return m_mediaPath;
}

void FrameCache::setMediaPath(const QString &path)
{
    {
        QMutexLocker lock(&m_mutex);
        if (m_mediaPath == path)
            return;
        m_mediaPath = path;
        m_frames.clear();
        m_lru.clear();
        m_inflight.clear();
        m_pending.clear();
        m_hits = 0;
        m_misses = 0;
        m_duration = 0;
    }
    emit mediaPathChanged();
    emit statsChanged();
    emit durationChanged();
    setStatus(path.isEmpty() ? QStringLiteral("idle") : QStringLiteral("ready"));
    if (!path.isEmpty())
        probeDuration();
}

void FrameCache::setFps(qreal fps)
{
    fps = qBound(1.0, fps, 120.0);
    if (qAbs(m_fps - fps) < 0.0001)
        return;
    m_fps = fps;
    emit fpsChanged();
}

void FrameCache::setCapacity(int n)
{
    n = qBound(8, n, 256);
    if (m_capacity == n)
        return;
    m_capacity = n;
    trim();
    emit capacityChanged();
}

int FrameCache::hits() const
{
    QMutexLocker lock(&m_mutex);
    return m_hits;
}

int FrameCache::misses() const
{
    QMutexLocker lock(&m_mutex);
    return m_misses;
}

bool FrameCache::busy() const
{
    QMutexLocker lock(&m_mutex);
    return m_busy;
}

QString FrameCache::status() const
{
    QMutexLocker lock(&m_mutex);
    return m_status;
}

void FrameCache::clear()
{
    {
        QMutexLocker lock(&m_mutex);
        m_frames.clear();
        m_lru.clear();
        m_inflight.clear();
        m_pending.clear();
        m_hits = 0;
        m_misses = 0;
    }
    emit statsChanged();
    setStatus(QStringLiteral("cleared"));
}

void FrameCache::setPlayhead(qreal seconds)
{
    seconds = qMax(0.0, seconds);
    if (m_duration > 0)
        seconds = qMin(seconds, m_duration);
    if (qAbs(m_playhead - seconds) < 0.0005)
        return;
    m_playhead = seconds;
    emit playheadChanged();

    const qint64 key = keyFor(seconds);
    requestKey(key, true);
    requestKey(key - 1, false);
    requestKey(key + 1, false);
    requestKey(key + 2, false);
}

void FrameCache::warm(qreal fromSeconds, qreal toSeconds)
{
    if (toSeconds < fromSeconds)
        qSwap(fromSeconds, toSeconds);
    const qint64 a = keyFor(fromSeconds);
    const qint64 b = keyFor(toSeconds);
    for (qint64 k = a; k <= b; ++k)
        requestKey(k, false);
}

void FrameCache::probeDuration()
{
    const QString path = mediaPath();
    if (path.isEmpty())
        return;
    setBusy(true);
    setStatus(QStringLiteral("probe"));
    (void) QtConcurrent::run([this, path]() {
        QProcess ff;
        ff.setProgram(QStringLiteral("ffprobe"));
        ff.setArguments({
            QStringLiteral("-v"), QStringLiteral("error"),
            QStringLiteral("-show_entries"), QStringLiteral("format=duration"),
            QStringLiteral("-of"), QStringLiteral("default=noprint_wrappers=1:nokey=1"),
            path,
        });
        ff.start();
        qreal duration = 0;
        if (ff.waitForFinished(5000) && ff.exitCode() == 0) {
            bool ok = false;
            duration = QString::fromUtf8(ff.readAllStandardOutput().trimmed()).toDouble(&ok);
            if (!ok)
                duration = 0;
        }
        QMetaObject::invokeMethod(this, [this, duration]() {
            m_duration = qMax(0.0, duration);
            emit durationChanged();
            setBusy(false);
            setStatus(QStringLiteral("ready"));
            if (m_duration > 0)
                setPlayhead(0);
        }, Qt::QueuedConnection);
    });
}

qint64 FrameCache::keyFor(qreal seconds) const
{
    return qint64(qFloor(seconds * m_fps + 0.5));
}

qreal FrameCache::secondsFor(qint64 key) const
{
    return qreal(key) / m_fps;
}

void FrameCache::requestKey(qint64 key, bool preferential)
{
    if (key < 0)
        return;
    QImage hit;
    {
        QMutexLocker lock(&m_mutex);
        if (m_mediaPath.isEmpty())
            return;
        if (m_frames.contains(key)) {
            hit = m_frames.value(key);
            ++m_hits;
        } else {
            ++m_misses;
        }
    }
    if (!hit.isNull()) {
        touch(key);
        if (preferential)
            emit frameReady(hit, secondsFor(key));
        emit statsChanged();
        return;
    }
    emit statsChanged();
    enqueueDecode(key);
}

void FrameCache::enqueueDecode(qint64 key)
{
    QString path;
    qreal fps;
    {
        QMutexLocker lock(&m_mutex);
        if (m_inflight.contains(key) || m_frames.contains(key))
            return;
        m_inflight.insert(key);
        m_pending.enqueue(key);
        path = m_mediaPath;
        fps = m_fps;
    }
    setBusy(true);
    setStatus(QStringLiteral("decode"));

    const qreal seconds = qreal(key) / fps;
    const int width = 1280;
    const int height = 720;
    // Resident worker pool — warm threads, no cold QtConcurrent storm.
    m_pool->submit(path, key, seconds, width, height);
}

void FrameCache::onDecoded(qint64 key, const QImage &image)
{
    QMetaObject::invokeMethod(this, [this, key, image]() {
        bool emitFrame = false;
        {
            QMutexLocker lock(&m_mutex);
            m_inflight.remove(key);
            if (!image.isNull()) {
                m_frames.insert(key, image);
                m_lru.removeAll(key);
                m_lru.prepend(key);
            }
            emitFrame = (key == keyFor(m_playhead)) && !image.isNull();
            m_busy = !m_inflight.isEmpty();
            m_status = m_busy ? QStringLiteral("decode") : QStringLiteral("ready");
        }
        trim();
        emit statsChanged();
        emit busyChanged();
        emit statusChanged();
        if (emitFrame)
            emit frameReady(image, secondsFor(key));
    }, Qt::QueuedConnection);
}

void FrameCache::touch(qint64 key)
{
    QMutexLocker lock(&m_mutex);
    m_lru.removeAll(key);
    m_lru.prepend(key);
}

void FrameCache::trim()
{
    QMutexLocker lock(&m_mutex);
    while (m_lru.size() > m_capacity) {
        const qint64 old = m_lru.takeLast();
        m_frames.remove(old);
    }
}

void FrameCache::setBusy(bool busy)
{
    {
        QMutexLocker lock(&m_mutex);
        if (m_busy == busy)
            return;
        m_busy = busy;
    }
    emit busyChanged();
}

void FrameCache::setStatus(const QString &status)
{
    {
        QMutexLocker lock(&m_mutex);
        if (m_status == status)
            return;
        m_status = status;
    }
    emit statusChanged();
}
