#pragma once

#include <QByteArray>
#include <QImage>
#include <QQuickItem>
#include <QSGTexture>
#include <QMutex>

/**
 * Soft Silver stage preview plane (G01 / G02).
 *
 * Presents through QSGSimpleTextureNode so the active Scene Graph RHI backend
 * (Vulkan when QSG_RHI_BACKEND=vulkan) composites the texture. presentFrame /
 * presentRgba feed decoded pixels; presentMediaFrame decodes via ffmpeg —
 * the native decode→texture path that replaces HTML <video>.
 */
class PreviewSurfaceItem : public QQuickItem
{
    Q_OBJECT
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(bool hasFrame READ hasFrame NOTIFY hasFrameChanged)
    Q_PROPERTY(QColor emptyColor READ emptyColor WRITE setEmptyColor NOTIFY emptyColorChanged)
    Q_PROPERTY(QString backend READ backend NOTIFY backendChanged)

public:
    explicit PreviewSurfaceItem(QQuickItem *parent = nullptr);
    ~PreviewSurfaceItem() override;

    QString status() const;
    bool hasFrame() const;
    QColor emptyColor() const;
    void setEmptyColor(const QColor &color);
    QString backend() const;

public slots:
    void presentFrame(const QImage &frame);
    void presentRgba(const QByteArray &rgba, int width, int height);
    void presentMediaFrame(const QString &path, double seconds);
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
    void setHasFrame(bool has);
    QImage makeEmptyStage(const QSize &size) const;

    mutable QMutex m_mutex;
    QString m_status = QStringLiteral("empty");
    QString m_backend = QStringLiteral("unknown");
    bool m_hasFrame = false;
    bool m_frameDirty = true;
    QColor m_emptyColor = QColor(0x11, 0x11, 0x11);
    QImage m_frame;
    QSGTexture *m_texture = nullptr;
};
