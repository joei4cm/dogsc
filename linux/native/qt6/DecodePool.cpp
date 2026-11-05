#include "DecodePool.h"

DecodePool::DecodePool(int workers, QObject *parent)
    : QObject(parent)
    , m_workerCount(qBound(1, workers, 8))
{
    ensureWorkers();
}

DecodePool::~DecodePool()
{
    cancelAll();
    for (Slot *slot : m_slots) {
        if (!slot)
            continue;
        if (slot->thread) {
            slot->thread->quit();
            slot->thread->wait(3000);
            delete slot->thread;
        }
        delete slot;
    }
    m_slots.clear();
}

void DecodePool::setWorkers(int n)
{
    n = qBound(1, n, 8);
    if (m_workerCount == n)
        return;
    m_workerCount = n;
    ensureWorkers();
    emit workersChanged();
    pump();
}

int DecodePool::pending() const
{
    QMutexLocker lock(&m_mutex);
    return m_queue.size();
}

int DecodePool::active() const
{
    QMutexLocker lock(&m_mutex);
    int n = 0;
    for (const Slot *slot : m_slots) {
        if (slot && slot->busy)
            ++n;
    }
    return n;
}

void DecodePool::ensureWorkers()
{
    while (m_slots.size() < m_workerCount) {
        auto *slot = new Slot;
        slot->thread = new QThread(this);
        slot->worker = new FrameDecodeWorker();
        slot->worker->moveToThread(slot->thread);
        connect(slot->thread, &QThread::finished, slot->worker, &QObject::deleteLater);
        slot->thread->start();
        m_slots.append(slot);
    }
    // Shrink idle extras only; busy slots finish naturally.
    while (m_slots.size() > m_workerCount) {
        Slot *slot = m_slots.last();
        if (slot->busy)
            break;
        m_slots.removeLast();
        slot->thread->quit();
        slot->thread->wait(2000);
        delete slot->thread;
        delete slot;
    }
}

void DecodePool::submit(const QString &path, qlonglong key, qreal seconds, int width, int height)
{
    {
        QMutexLocker lock(&m_mutex);
        Job job{path, key, seconds, width, height};
        m_queue.enqueue(job);
    }
    emit statsChanged();
    pump();
}

void DecodePool::cancelAll()
{
    QMutexLocker lock(&m_mutex);
    m_queue.clear();
    emit statsChanged();
}

void DecodePool::pump()
{
    for (;;) {
        Slot *free = nullptr;
        Job job;
        {
            QMutexLocker lock(&m_mutex);
            if (m_queue.isEmpty())
                return;
            for (Slot *slot : m_slots) {
                if (slot && !slot->busy) {
                    free = slot;
                    break;
                }
            }
            if (!free)
                return;
            job = m_queue.dequeue();
            free->busy = true;
        }
        emit statsChanged();

        Slot *slot = free;
        // Disconnect previous one-shot handlers, then fire decode on worker thread.
        disconnect(slot->worker, &FrameDecodeWorker::finished, this, nullptr);
        connect(slot->worker, &FrameDecodeWorker::finished, this,
                [this, slot](qlonglong key, const QImage &image) {
                    onWorkerFinished(slot, key, image);
                },
                Qt::QueuedConnection);
        QMetaObject::invokeMethod(slot->worker, "decode", Qt::QueuedConnection,
                                  Q_ARG(QString, job.path),
                                  Q_ARG(qlonglong, job.key),
                                  Q_ARG(qreal, job.seconds),
                                  Q_ARG(int, job.width),
                                  Q_ARG(int, job.height));
    }
}

void DecodePool::onWorkerFinished(Slot *slot, qlonglong key, const QImage &image)
{
    {
        QMutexLocker lock(&m_mutex);
        if (slot)
            slot->busy = false;
    }
    emit finished(key, image);
    emit statsChanged();
    pump();
}
