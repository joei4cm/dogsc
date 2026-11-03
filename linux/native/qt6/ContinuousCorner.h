#pragma once

#include <QColor>
#include <QImage>
#include <QObject>
#include <QPainterPath>
#include <QQuickPaintedItem>

/**
 * Apple-style continuous (smooth) corner helpers for Soft Silver chrome (G04).
 *
 * Path generation uses a Figma/iOS-style smooth-corner cubic approximation
 * (smoothness 0.6 ≈ system continuous). Raster masks are A8 coverage suitable
 * for OpacityMask / Scene Graph clipping. GPU SDF fill lives in
 * ContinuousSdfPanel.qml + shaders/continuous_corner.*.
 */
class ContinuousCorner : public QObject
{
    Q_OBJECT

public:
    explicit ContinuousCorner(QObject *parent = nullptr);

    /** Build a continuous rounded-rect path. smoothness 0..1 (0.6 ≈ Apple). */
    Q_INVOKABLE QPainterPath path(qreal x, qreal y, qreal w, qreal h,
                                  qreal radius, qreal smoothness = 0.6) const;

    /** A8 coverage mask (white = opaque). */
    Q_INVOKABLE QImage mask(int width, int height, qreal radius,
                            qreal smoothness = 0.6) const;

    static QPainterPath makePath(const QRectF &rect, qreal radius,
                                 qreal smoothness = 0.6);
    static QImage makeMask(const QSize &size, qreal radius,
                           qreal smoothness = 0.6);
};

/**
 * Soft Silver panel with continuous corners — drop-in chrome surface for
 * islands, capsules, and sheets that must not look like CSS circular radius.
 */
class ContinuousPanelItem : public QQuickPaintedItem
{
    Q_OBJECT
    Q_PROPERTY(QColor color READ color WRITE setColor NOTIFY colorChanged)
    Q_PROPERTY(QColor borderColor READ borderColor WRITE setBorderColor NOTIFY borderColorChanged)
    Q_PROPERTY(qreal borderWidth READ borderWidth WRITE setBorderWidth NOTIFY borderWidthChanged)
    Q_PROPERTY(qreal radius READ radius WRITE setRadius NOTIFY radiusChanged)
    Q_PROPERTY(qreal smoothness READ smoothness WRITE setSmoothness NOTIFY smoothnessChanged)

public:
    explicit ContinuousPanelItem(QQuickItem *parent = nullptr);

    QColor color() const { return m_color; }
    void setColor(const QColor &c);

    QColor borderColor() const { return m_borderColor; }
    void setBorderColor(const QColor &c);

    qreal borderWidth() const { return m_borderWidth; }
    void setBorderWidth(qreal w);

    qreal radius() const { return m_radius; }
    void setRadius(qreal r);

    qreal smoothness() const { return m_smoothness; }
    void setSmoothness(qreal s);

    void paint(QPainter *painter) override;

signals:
    void colorChanged();
    void borderColorChanged();
    void borderWidthChanged();
    void radiusChanged();
    void smoothnessChanged();

private:
    QColor m_color = QColor(0xfd, 0xfd, 0xfe);
    QColor m_borderColor = QColor(26, 31, 46, 15);
    qreal m_borderWidth = 0.5;
    qreal m_radius = 22.0;
    qreal m_smoothness = 0.6;
};
