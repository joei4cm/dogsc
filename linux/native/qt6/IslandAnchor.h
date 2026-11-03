#pragma once

#include <QObject>
#include <QPointer>
#include <QWindow>

/**
 * Soft Silver floating recorder island placement (G03).
 *
 * Modes:
 *  - "layer-shell" — zwlr_layer_shell_v1 bottom-center overlay when Wayland
 *    exposes a wl_surface (NSPanel stand-in).
 *  - "screen" — QScreen geometry bottom-center (X11 / fallback).
 *  - "floating" — leave the window where the user dragged it.
 */
class IslandAnchor : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QWindow *window READ window WRITE setWindow NOTIFY windowChanged)
    Q_PROPERTY(QString mode READ mode NOTIFY modeChanged)
    Q_PROPERTY(int bottomMargin READ bottomMargin WRITE setBottomMargin NOTIFY bottomMarginChanged)
    Q_PROPERTY(bool layerShellAvailable READ layerShellAvailable NOTIFY modeChanged)

public:
    explicit IslandAnchor(QObject *parent = nullptr);
    ~IslandAnchor() override;

    QWindow *window() const { return m_window; }
    void setWindow(QWindow *window);

    QString mode() const { return m_mode; }
    bool layerShellAvailable() const { return m_layerShellReady; }

    int bottomMargin() const { return m_bottomMargin; }
    void setBottomMargin(int margin);

public slots:
    void reanchor();
    void preferLayerShell(bool enabled);

signals:
    void windowChanged();
    void modeChanged();
    void bottomMarginChanged();

private:
    bool tryApplyLayerShell();
    void applyScreenAnchor();

    QPointer<QWindow> m_window;
    QString m_mode = QStringLiteral("floating");
    int m_bottomMargin = 36;
    bool m_preferLayerShell = true;
    bool m_layerShellReady = false;
    void *m_layerSurface = nullptr; // zwlr_layer_surface_v1*
};
