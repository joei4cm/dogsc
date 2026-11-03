#include "PreviewSurfaceItem.h"

#include <QPainter>
#include <QProcess>
#include <QQuickWindow>
#include <QSGRendererInterface>
#include <QSGSimpleTextureNode>

PreviewSurfaceItem::PreviewSurfaceItem(QQuickItem *parent)
    : QQuickItem(parent)
{
    setFlag(ItemHasContents, true);
    refreshBackend();
}

PreviewSurfaceItem::~PreviewSurfaceItem()
{
    delete m_texture;
    m_texture = nullptr;
}

QString PreviewSurfaceItem::status() const
{
    QMutexLocker lock(&m_mutex);
    return m_status;
}

bool PreviewSurfaceItem::hasFrame() const
{
    QMutexLocker lock(&m_mutex);
    return m_hasFrame;
}

QColor PreviewSurfaceItem::emptyColor() const
{
    QMutexLocker lock(&m_mutex);
    return m_emptyColor;
}

void PreviewSurfaceItem::setEmptyColor(const QColor &color)
{
    {
        QMutexLocker lock(&m_mutex);
        if (m_emptyColor == color)
            return;
        m_emptyColor = color;
        if (!m_hasFrame)
            m_frameDirty = true;
    }
    emit emptyColorChanged();
    update();
}

QString PreviewSurfaceItem::backend() const
{
    QMutexLocker lock(&m_mutex);
    return m_backend;
}

void PreviewSurfaceItem::refreshBackend()
{
    QString name = QString::fromLocal8Bit(qgetenv("QSG_RHI_BACKEND"));
    if (name.isEmpty())
        name = QStringLiteral("default");
    if (window() && window()->rendererInterface()) {
        const auto api = window()->rendererInterface()->graphicsApi();
        using RI = QSGRendererInterface;
        switch (api) {
        case RI::Software: name = QStringLiteral("software"); break;
        case RI::OpenGL: name = QStringLiteral("opengl"); break;
        case RI::Direct3D11: name = QStringLiteral("d3d11"); break;
        case RI::Vulkan: name = QStringLiteral("vulkan"); break;
        case RI::Metal: name = QStringLiteral("metal"); break;
        case RI::Null: name = QStringLiteral("null"); break;
        default: break;
        }
    }
    {
        QMutexLocker lock(&m_mutex);
        if (m_backend == name)
            return;
        m_backend = name;
    }
    emit backendChanged();
}

void PreviewSurfaceItem::itemChange(ItemChange change, const ItemChangeData &value)
{
    QQuickItem::itemChange(change, value);
    if (change == ItemSceneChange)
        refreshBackend();
}

void PreviewSurfaceItem::presentFrame(const QImage &frame)
{
    if (frame.isNull()) {
        clearFrame();
        return;
    }
    {
        QMutexLocker lock(&m_mutex);
        m_frame = frame.convertToFormat(QImage::Format_RGBA8888);
        m_frameDirty = true;
        m_hasFrame = true;
        m_status = QStringLiteral("frame");
    }
    emit hasFrameChanged();
    emit statusChanged();
    refreshBackend();
    update();
}

void PreviewSurfaceItem::presentRgba(const QByteArray &rgba, int width, int height)
{
    if (rgba.isEmpty() || width <= 0 || height <= 0) {
        clearFrame();
        return;
    }
    QImage img(reinterpret_cast<const uchar *>(rgba.constData()),
               width, height, width * 4, QImage::Format_RGBA8888);
    presentFrame(img.copy());
}

void PreviewSurfaceItem::presentMediaFrame(const QString &path, double seconds)
{
    if (path.isEmpty()) {
        clearFrame();
        return;
    }
    const int width = 1280;
    const int height = 720;
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
    if (!ff.waitForFinished(8000) || ff.exitCode() != 0) {
        setStatus(QStringLiteral("decode-error"));
        return;
    }
    const QByteArray rgba = ff.readAllStandardOutput();
    const int expect = width * height * 4;
    if (rgba.size() < expect) {
        setStatus(QStringLiteral("decode-short"));
        return;
    }
    presentRgba(rgba.left(expect), width, height);
    setStatus(QStringLiteral("media-frame"));
}

void PreviewSurfaceItem::clearFrame()
{
    {
        QMutexLocker lock(&m_mutex);
        m_frame = QImage();
        m_frameDirty = true;
        m_hasFrame = false;
        m_status = QStringLiteral("empty");
    }
    emit hasFrameChanged();
    emit statusChanged();
    update();
}

void PreviewSurfaceItem::setStatus(const QString &status)
{
    {
        QMutexLocker lock(&m_mutex);
        if (m_status == status)
            return;
        m_status = status;
    }
    emit statusChanged();
}

void PreviewSurfaceItem::setHasFrame(bool has)
{
    {
        QMutexLocker lock(&m_mutex);
        if (m_hasFrame == has)
            return;
        m_hasFrame = has;
    }
    emit hasFrameChanged();
}

QImage PreviewSurfaceItem::makeEmptyStage(const QSize &size) const
{
    const QSize px(qMax(2, size.width()), qMax(2, size.height()));
    QColor empty;
    QString backend;
    {
        QMutexLocker lock(&m_mutex);
        empty = m_emptyColor;
        backend = m_backend;
    }
    QImage img(px, QImage::Format_RGBA8888);
    img.fill(empty);

    QPainter p(&img);
    p.setRenderHint(QPainter::Antialiasing, true);
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
    const QString hint = QStringLiteral("QSG · %1 · G01/G02").arg(backend);
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
    if (bounds.isEmpty() || !window())
        return node;

    const qreal dpr = window()->effectiveDevicePixelRatio();
    const QSize texSize(qMax(2, int(bounds.width() * dpr)),
                        qMax(2, int(bounds.height() * dpr)));

    bool dirty = false;
    bool has = false;
    QImage frame;
    {
        QMutexLocker lock(&m_mutex);
        dirty = m_frameDirty;
        has = m_hasFrame;
        frame = m_frame;
    }

    if (dirty || !m_texture || m_texture->textureSize() != texSize) {
        QImage source = (has && !frame.isNull())
            ? frame.scaled(texSize, Qt::IgnoreAspectRatio, Qt::SmoothTransformation)
            : makeEmptyStage(texSize);

        delete m_texture;
        m_texture = window()->createTextureFromImage(source, QQuickWindow::TextureIsOpaque);
        node->setTexture(m_texture);
        {
            QMutexLocker lock(&m_mutex);
            m_frameDirty = false;
            m_status = has ? QStringLiteral("frame-qsg") : QStringLiteral("empty-qsg");
        }
        emit statusChanged();
        refreshBackend();
    }

    node->setRect(bounds);
    return node;
}
