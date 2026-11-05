#pragma once

#include <QImage>
#include <QMutex>
#include <QObject>
#include <QQueue>
#include <QThread>
#include <QVector>

#include "FrameCache.h"

/**
 * Resident ffmpeg decode worker pool (G02 demuxer-pool enhancement).
 *
 * Keeps N QThreads alive so scrub ticks reuse warm workers instead of
 * cold QtConcurrent::run + process spawn storms.
 */
class DecodePool : public QObject
{
    Q_OBJECT
    Q_PROPERTY(int workers READ workers WRITE setWorkers NOTIFY workersChanged)
    Q_PROPERTY(int pending READ pending NOTIFY statsChanged)
    Q_PROPERTY(int active READ active NOTIFY statsChanged)

public:
    explicit DecodePool(int workers = 2, QObject *parent = nullptr);
    ~DecodePool() override;

    int workers() const { return m_workerCount; }
    void setWorkers(int n);
    int pending() const;
    int active() const;

public slots:
    void submit(const QString &path, qlonglong key, qreal seconds, int width, int height);
    void cancelAll();

signals:
    void finished(qlonglong key, const QImage &image);
    void workersChanged();
    void statsChanged();

private:
    struct Job {
        QString path;
        qlonglong key = 0;
        qreal seconds = 0;
        int width = 0;
        int height = 0;
    };
    struct Slot {
        QThread *thread = nullptr;
        FrameDecodeWorker *worker = nullptr;
        bool busy = false;
    };

    void ensureWorkers();
    void pump();
    void onWorkerFinished(Slot *slot, qlonglong key, const QImage &image);

    mutable QMutex m_mutex;
    int m_workerCount = 2;
    QVector<Slot *> m_slots;
    QQueue<Job> m_queue;
};
