#include "PreviewSurfaceItem.h"

#include <QPainter>
#include <QSGSimpleTextureNode>
#include <QQuickWindow>

PreviewSurfaceItem::PreviewSurfaceItem(QQuickItem *parent)
    : QQuickItem(parent)
{
    setFlag(ItemHasContents, true);
}

void PreviewSurfaceItem::setEmptyColor(const QColor &color)
{
    if (m_emptyColor == color)
        return;
    m_emptyColor = color;
    if (!m_hasFrame) {
        m_frameDirty = true;
        update();
    }
    emit emptyColorChanged();
}

void PreviewSurfaceItem::presentFrame(const QImage &frame)
{
    if (frame.isNull()) {
        clearFrame();
        return;
    }
    m_frame = frame.convertToFormat(QImage::Format_RGBA8888);
    m_frameDirty = true;
    setHasFrame(true);
    setStatus(QStringLiteral("frame"));
    update();
}

void PreviewSurfaceItem::clearFrame()
{
    m_frame = QImage();
    m_frameDirty = true;
    setHasFrame(false);
    setStatus(QStringLiteral("empty"));
    update();
}

void PreviewSurfaceItem::setStatus(const QString &status)
{
    if (m_status == status)
        return;
    m_status = status;
    emit statusChanged();
}

void PreviewSurfaceItem::setHasFrame(bool has)
{
    if (m_hasFrame == has)
        return;
    m_hasFrame = has;
    emit hasFrameChanged();
}

QImage PreviewSurfaceItem::makeEmptyStage(const QSize &size) const
{
    const QSize px(qMax(2, size.width()), qMax(2, size.height()));
    QImage img(px, QImage::Format_RGBA8888);
    img.fill(m_emptyColor);

    QPainter p(&img);
    p.setRenderHint(QPainter::Antialiasing, true);
    p.setPen(Qt::NoPen);

    // Soft Silver empty-stage wash — atmosphere, not a card.
    QLinearGradient wash(0, 0, 0, px.height());
    wash.setColorAt(0.0, QColor(255, 255, 255, 28));
    wash.setColorAt(0.55, QColor(255, 255, 255, 0));
    wash.setColorAt(1.0, QColor(16, 18, 24, 40));
    p.fillRect(img.rect(), wash);

    p.setPen(QColor(253, 253, 254, 200));
    QFont title = p.font();
    title.setPixelSize(qMax(12, px.height() / 18));
    title.setWeight(QFont::DemiBold);
    p.setFont(title);
    const QString label = QStringLiteral("PreviewSurface");
    const QFontMetrics fm(title);
    const int tx = (px.width() - fm.horizontalAdvance(label)) / 2;
    const int ty = px.height() / 2 - fm.height();
    p.drawText(tx, ty + fm.ascent(), label);

    p.setPen(QColor(255, 255, 255, 110));
    QFont sub = title;
    sub.setPixelSize(qMax(10, px.height() / 28));
    sub.setWeight(QFont::Normal);
    p.setFont(sub);
    const QString hint = QStringLiteral("QSGTexture · Vulkan RHI path · G01");
    const QFontMetrics sfm(sub);
    const int sx = (px.width() - sfm.horizontalAdvance(hint)) / 2;
    p.drawText(sx, ty + fm.height() + 10 + sfm.ascent(), hint);
    p.end();
    return img;
}

QSGNode *PreviewSurfaceItem::updatePaintNode(QSGNode *oldNode, UpdatePaintNodeData *)
{
    auto *node = static_cast<QSGSimpleTextureNode *>(oldNode);
    if (!node) {
        node = new QSGSimpleTextureNode();
        node->setOwnsTexture(false);
        node->setFiltering(QSGTexture::Linear);
    }

    const QRectF bounds = boundingRect();
    if (bounds.isEmpty())
        return node;

    const qreal dpr = window() ? window()->effectiveDevicePixelRatio() : 1.0;
    const QSize texSize(qMax(2, int(bounds.width() * dpr)),
                        qMax(2, int(bounds.height() * dpr)));

    if (m_frameDirty || !m_texture
        || m_texture->textureSize() != texSize) {
        QImage source;
        if (m_hasFrame && !m_frame.isNull()) {
            source = m_frame.scaled(texSize, Qt::IgnoreAspectRatio, Qt::SmoothTransformation);
        } else {
            source = makeEmptyStage(texSize);
        }

        delete m_texture;
        m_texture = window()->createTextureFromImage(source, QQuickWindow::TextureIsOpaque);
        node->setTexture(m_texture);
        m_frameDirty = false;
        setStatus(m_hasFrame ? QStringLiteral("frame")
                             : QStringLiteral("empty-qsg"));
    }

    node->setRect(bounds);
    return node;
}
