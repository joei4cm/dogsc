#pragma once

#include <QByteArray>
#include <QImage>
#include <QQuickItem>
#include <QSGTexture>
#include <QMutex>

/**
 * Soft Silver stage preview plane (G01 / G02).
 *
 * Presents through the Scene Graph. When the window's QRhi is live, frames go
 * through QSGPlainTexture (RHI-backed, Vulkan when QSG_RHI_BACKEND=vulkan).
 * presentNativeTexture() wraps an existing native GPU handle without a CPU
 * round-trip — the zero-copy import seam for DMA-BUF / external exporters.
 */
class PreviewSurfaceItem : public QQuickItem
{
    Q_OBJECT
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(bool hasFrame READ hasFrame NOTIFY hasFrameChanged)
    Q_PROPERTY(QColor emptyColor READ emptyColor WRITE setEmptyColor NOTIFY emptyColorChanged)
    Q_PROPERTY(QString backend READ backend NOTIFY backendChanged)
    Q_PROPERTY(bool nativeTexture READ hasNativeTexture NOTIFY hasFrameChanged)

public:
    explicit PreviewSurfaceItem(QQuickItem *parent = nullptr);
    ~PreviewSurfaceItem() override;

    QString status() const;
    bool hasFrame() const;
    bool hasNativeTexture() const;
    QColor emptyColor() const;
    void setEmptyColor(const QColor &color);
    QString backend() const;

public slots:
    void presentFrame(const QImage &frame);
    void presentRgba(const QByteArray &rgba, int width, int height);
    void presentMediaFrame(const QString &path, double seconds);
    /**
     * Zero-copy import: wrap an existing native texture handle
     * (GL name / VkImage as quint64) into the Scene Graph via QRhi.
     */
    void presentNativeTexture(qulonglong handle, int width, int height,
                              const QString &api = QStringLiteral("auto"));
    void clearFrame();
    void refreshBackend();

signals:
    void statusChanged();
    void hasFrameChanged();
    void emptyColorChanged();
    void backendChanged();

protected:
    QSGNode *updatePaintNode(QSGNode *oldNode, UpdatePaintNodeData *) override;
    void itemChange(ItemChange change, const ItemChangeData &value) override;

private:
    void setStatus(const QString &status);
    QImage makeEmptyStage(const QSize &size) const;

    mutable QMutex m_mutex;
    QString m_status = QStringLiteral("empty");
    QString m_backend = QStringLiteral("unknown");
    bool m_hasFrame = false;
    bool m_frameDirty = true;
    QColor m_emptyColor = QColor(0x11, 0x11, 0x11);
    QImage m_frame;
    QSGTexture *m_texture = nullptr;

    qulonglong m_nativeHandle = 0;
    int m_nativeWidth = 0;
    int m_nativeHeight = 0;
    QString m_nativeApi;
};
