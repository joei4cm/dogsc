#include "ContinuousCorner.h"

#include <QPainter>
#include <QtMath>

ContinuousCorner::ContinuousCorner(QObject *parent)
    : QObject(parent)
{
}

QPainterPath ContinuousCorner::path(qreal x, qreal y, qreal w, qreal h,
                                    qreal radius, qreal smoothness) const
{
    return makePath(QRectF(x, y, w, h), radius, smoothness);
}

QImage ContinuousCorner::mask(int width, int height, qreal radius,
                              qreal smoothness) const
{
    return makeMask(QSize(width, height), radius, smoothness);
}

QPainterPath ContinuousCorner::makePath(const QRectF &rect, qreal radius,
                                        qreal smoothness)
{
    QPainterPath path;
    if (rect.isEmpty())
        return path;

    const qreal maxR = qMin(rect.width(), rect.height()) / 2.0;
    radius = qBound(0.0, radius, maxR);
    smoothness = qBound(0.0, smoothness, 1.0);

    if (radius <= 0.0) {
        path.addRect(rect);
        return path;
    }

    // Nearly circular / capsule — true ellipse reads closer than a forced
    // continuous corner when radius consumes the short edge.
    if (radius >= maxR - 0.25 && qAbs(rect.width() - rect.height()) < 0.5) {
        path.addEllipse(rect);
        return path;
    }

    // Figma/iOS smooth-corner cubic approximation.
    // smoothness 0 → circular Bézier; 0.6 ≈ Apple `cornerCurve = .continuous`.
    const qreal corner = radius;
    const qreal smooth = smoothness;

    // Straight edge before the curve begins grows with smoothness so the
    // corner starts earlier along each edge (G2-ish continuous feel).
    const qreal p = corner * (1.0 + smooth * 0.528665);
    const qreal edge = qMin(p, qMin(rect.width(), rect.height()) / 2.0);

    // Cubic handle length. Circular kappa ≈ 0.5523; continuous lengthens
    // slightly then eases as smoothness rises so the curve stays taut.
    const qreal kappa = 0.551915024494 + smooth * 0.086;
    const qreal handle = corner * kappa * (1.0 - smooth * 0.18);

    const qreal left = rect.left();
    const qreal top = rect.top();
    const qreal right = rect.right();
    const qreal bottom = rect.bottom();

    auto clampEdge = [&](qreal value, qreal limit) {
        return qMin(value, limit / 2.0);
    };
    const qreal ex = clampEdge(edge, rect.width());
    const qreal ey = clampEdge(edge, rect.height());
    const qreal hx = qMin(handle, ex);
    const qreal hy = qMin(handle, ey);

    path.moveTo(left + ex, top);

    // Top edge → top-right corner
    path.lineTo(right - ex, top);
    path.cubicTo(right - ex + hx, top,
                 right, top + ey - hy,
                 right, top + ey);

    // Right edge → bottom-right
    path.lineTo(right, bottom - ey);
    path.cubicTo(right, bottom - ey + hy,
                 right - ex + hx, bottom,
                 right - ex, bottom);

    // Bottom edge → bottom-left
    path.lineTo(left + ex, bottom);
    path.cubicTo(left + ex - hx, bottom,
                 left, bottom - ey + hy,
                 left, bottom - ey);

    // Left edge → top-left
    path.lineTo(left, top + ey);
    path.cubicTo(left, top + ey - hy,
                 left + ex - hx, top,
                 left + ex, top);

    path.closeSubpath();
    return path;
}

QImage ContinuousCorner::makeMask(const QSize &size, qreal radius,
                                  qreal smoothness)
{
    const QSize px(qMax(1, size.width()), qMax(1, size.height()));
    QImage img(px, QImage::Format_Alpha8);
    img.fill(0);

    QPainter p(&img);
    p.setRenderHint(QPainter::Antialiasing, true);
    p.setPen(Qt::NoPen);
    p.setBrush(Qt::white);
    p.drawPath(makePath(QRectF(0, 0, px.width(), px.height()), radius, smoothness));
    p.end();
    return img;
}

ContinuousPanelItem::ContinuousPanelItem(QQuickItem *parent)
    : QQuickPaintedItem(parent)
{
    setAntialiasing(true);
    setOpaquePainting(false);
}

void ContinuousPanelItem::setColor(const QColor &c)
{
    if (m_color == c)
        return;
    m_color = c;
    emit colorChanged();
    update();
}

void ContinuousPanelItem::setBorderColor(const QColor &c)
{
    if (m_borderColor == c)
        return;
    m_borderColor = c;
    emit borderColorChanged();
    update();
}

void ContinuousPanelItem::setBorderWidth(qreal w)
{
    if (qAbs(m_borderWidth - w) < 0.0001)
        return;
    m_borderWidth = w;
    emit borderWidthChanged();
    update();
}

void ContinuousPanelItem::setRadius(qreal r)
{
    if (qAbs(m_radius - r) < 0.0001)
        return;
    m_radius = r;
    emit radiusChanged();
    update();
}

void ContinuousPanelItem::setSmoothness(qreal s)
{
    if (qAbs(m_smoothness - s) < 0.0001)
        return;
    m_smoothness = s;
    emit smoothnessChanged();
    update();
}

void ContinuousPanelItem::paint(QPainter *painter)
{
    painter->setRenderHint(QPainter::Antialiasing, true);
    const QRectF bounds(0, 0, width(), height());
    const QPainterPath outline =
        ContinuousCorner::makePath(bounds, m_radius, m_smoothness);

    painter->setPen(Qt::NoPen);
    painter->setBrush(m_color);
    painter->drawPath(outline);

    if (m_borderWidth > 0.0 && m_borderColor.alpha() > 0) {
        QPen pen(m_borderColor, m_borderWidth);
        pen.setJoinStyle(Qt::RoundJoin);
        painter->setPen(pen);
        painter->setBrush(Qt::NoBrush);
        const qreal inset = m_borderWidth * 0.5;
        painter->drawPath(
            ContinuousCorner::makePath(bounds.adjusted(inset, inset, -inset, -inset),
                                       qMax(0.0, m_radius - inset),
                                       m_smoothness));
    }
}
