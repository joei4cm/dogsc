#pragma once

#include <QImage>
#include <QQuickItem>
#include <QSGTexture>

/**
 * Soft Silver stage preview plane (G01).
 *
 * Presents frames through the Qt Scene Graph texture path so the same item can
 * later accept zero-copy RHI / Vulkan uploads (QRhiTexture → QSGTexture) without
 * swapping the QML surface. Display only — capture/export stay on the Python
 * ffmpeg sidecar.
 */
class PreviewSurfaceItem : public QQuickItem
{
    Q_OBJECT
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(bool hasFrame READ hasFrame NOTIFY hasFrameChanged)
    Q_PROPERTY(QColor emptyColor READ emptyColor WRITE setEmptyColor NOTIFY emptyColorChanged)

public:
    explicit PreviewSurfaceItem(QQuickItem *parent = nullptr);

    QString status() const { return m_status; }
    bool hasFrame() const { return m_hasFrame; }

    QColor emptyColor() const { return m_emptyColor; }
    void setEmptyColor(const QColor &color);

public slots:
    /** Upload a CPU frame (RGBA8888 / RGB32 preferred). Later: RHI texture import. */
    void presentFrame(const QImage &frame);
    void clearFrame();

signals:
    void statusChanged();
    void hasFrameChanged();
    void emptyColorChanged();

protected:
    QSGNode *updatePaintNode(QSGNode *oldNode, UpdatePaintNodeData *) override;

private:
    void setStatus(const QString &status);
    void setHasFrame(bool has);
    QImage makeEmptyStage(const QSize &size) const;

    QString m_status = QStringLiteral("empty");
    bool m_hasFrame = false;
    bool m_frameDirty = true;
    QColor m_emptyColor = QColor(0x11, 0x11, 0x11);
    QImage m_frame;
    QSGTexture *m_texture = nullptr;
};
