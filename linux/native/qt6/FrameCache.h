#pragma once

#include <QHash>
#include <QImage>
#include <QMutex>
#include <QObject>
#include <QQueue>
#include <QSet>

/**
 * Resident decode→texture cache for Soft Silver scrub (G02 enhancement).
 *
 * Quantizes playhead to a frame grid, keeps an LRU of RGBA frames, and
 * prefeches neighbours so Fast/Full scrub stays on the GPU texture path
 * instead of spawning a cold ffmpeg per tick.
 */
class FrameCache : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString mediaPath READ mediaPath WRITE setMediaPath NOTIFY mediaPathChanged)
    Q_PROPERTY(qreal duration READ duration NOTIFY durationChanged)
    Q_PROPERTY(qreal fps READ fps WRITE setFps NOTIFY fpsChanged)
    Q_PROPERTY(qreal playhead READ playhead WRITE setPlayhead NOTIFY playheadChanged)
    Q_PROPERTY(int capacity READ capacity WRITE setCapacity NOTIFY capacityChanged)
    Q_PROPERTY(int hits READ hits NOTIFY statsChanged)
    Q_PROPERTY(int misses READ misses NOTIFY statsChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)

public:
    explicit FrameCache(QObject *parent = nullptr);
    ~FrameCache() override;

    QString mediaPath() const;
    void setMediaPath(const QString &path);

    qreal duration() const { return m_duration; }
    qreal fps() const { return m_fps; }
    void setFps(qreal fps);

    qreal playhead() const { return m_playhead; }
    void setPlayhead(qreal seconds);

    int capacity() const { return m_capacity; }
    void setCapacity(int n);

    int hits() const;
    int misses() const;
    bool busy() const;
    QString status() const;

public slots:
    void clear();
    void warm(qreal fromSeconds, qreal toSeconds);
    void probeDuration();

signals:
    void mediaPathChanged();
    void durationChanged();
    void fpsChanged();
    void playheadChanged();
    void capacityChanged();
    void statsChanged();
    void busyChanged();
    void statusChanged();
    /** Decoded RGBA frame ready for PreviewSurface.presentFrame. */
    void frameReady(const QImage &frame, qreal seconds);

private:
    qint64 keyFor(qreal seconds) const;
    qreal secondsFor(qint64 key) const;
    void requestKey(qint64 key, bool preferential);
    void enqueueDecode(qint64 key);
    void onDecoded(qint64 key, const QImage &image);
    void touch(qint64 key);
    void setBusy(bool busy);
    void setStatus(const QString &status);
    void trim();

    mutable QMutex m_mutex;
    QString m_mediaPath;
    qreal m_duration = 0;
    qreal m_fps = 30;
    qreal m_playhead = 0;
    int m_capacity = 48;
    int m_hits = 0;
    int m_misses = 0;
    bool m_busy = false;
    QString m_status = QStringLiteral("idle");

    QHash<qint64, QImage> m_frames;
    QList<qint64> m_lru;
    QSet<qint64> m_inflight;
    QQueue<qint64> m_pending;
    class DecodePool *m_pool = nullptr;
};

class FrameDecodeWorker : public QObject
{
    Q_OBJECT
public:
    explicit FrameDecodeWorker(QObject *parent = nullptr);

public slots:
    void decode(const QString &path, qlonglong key, qreal seconds, int width, int height);

signals:
    void finished(qlonglong key, const QImage &image);
};
