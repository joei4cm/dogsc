#include "IslandAnchor.h"

#include <QGuiApplication>
#include <QScreen>

#include <cstring>

#if defined(DOGSC_HAS_WAYLAND_CLIENT) && DOGSC_HAS_WAYLAND_CLIENT
#include <wayland-client.h>
#include <qpa/qplatformnativeinterface.h>
// wayland-scanner emits a parameter named `namespace` — illegal in C++.
#define namespace dogsc_layer_namespace
extern "C" {
#include "wlr-layer-shell-unstable-v1-client-protocol.h"
}
#undef namespace
#define DOGSC_HAVE_LAYER_SHELL 1
#else
#define DOGSC_HAVE_LAYER_SHELL 0
#endif

#if DOGSC_HAVE_LAYER_SHELL
struct LayerShellState {
    wl_registry *registry = nullptr;
    zwlr_layer_shell_v1 *shell = nullptr;
    zwlr_layer_surface_v1 *surface = nullptr;
    wl_output *output = nullptr;
};

static void registryGlobal(void *data, wl_registry *registry, uint32_t name,
                           const char *interface, uint32_t version)
{
    auto *state = static_cast<LayerShellState *>(data);
    if (strcmp(interface, zwlr_layer_shell_v1_interface.name) == 0) {
        state->shell = static_cast<zwlr_layer_shell_v1 *>(
            wl_registry_bind(registry, name, &zwlr_layer_shell_v1_interface,
                             qMin(version, 4u)));
    } else if (strcmp(interface, "wl_output") == 0 && !state->output) {
        state->output = static_cast<wl_output *>(
            wl_registry_bind(registry, name, &wl_output_interface, 1));
    }
}

static void registryGlobalRemove(void *, wl_registry *, uint32_t) {}

static const wl_registry_listener kRegistryListener = {
    registryGlobal,
    registryGlobalRemove,
};

static void layerSurfaceConfigure(void *data, zwlr_layer_surface_v1 *surface,
                                  uint32_t serial, uint32_t width, uint32_t height)
{
    Q_UNUSED(data)
    Q_UNUSED(width)
    Q_UNUSED(height)
    zwlr_layer_surface_v1_ack_configure(surface, serial);
}

static void layerSurfaceClosed(void *data, zwlr_layer_surface_v1 *)
{
    auto *self = static_cast<IslandAnchor *>(data);
    Q_UNUSED(self)
}

static const zwlr_layer_surface_v1_listener kLayerSurfaceListener = {
    layerSurfaceConfigure,
    layerSurfaceClosed,
};
#endif

IslandAnchor::IslandAnchor(QObject *parent)
    : QObject(parent)
{
}

IslandAnchor::~IslandAnchor()
{
#if DOGSC_HAVE_LAYER_SHELL
    if (m_layerSurface) {
        zwlr_layer_surface_v1_destroy(
            static_cast<zwlr_layer_surface_v1 *>(m_layerSurface));
        m_layerSurface = nullptr;
    }
#endif
}

void IslandAnchor::setWindow(QWindow *window)
{
    if (m_window == window)
        return;
    m_window = window;
    emit windowChanged();
    reanchor();
}

void IslandAnchor::setBottomMargin(int margin)
{
    if (m_bottomMargin == margin)
        return;
    m_bottomMargin = margin;
    emit bottomMarginChanged();
    reanchor();
}

void IslandAnchor::preferLayerShell(bool enabled)
{
    m_preferLayerShell = enabled;
    reanchor();
}

void IslandAnchor::reanchor()
{
    if (!m_window)
        return;

    if (m_preferLayerShell && tryApplyLayerShell()) {
        if (m_mode != QLatin1String("layer-shell")) {
            m_mode = QStringLiteral("layer-shell");
            emit modeChanged();
        }
        return;
    }

    applyScreenAnchor();
    if (m_mode != QLatin1String("screen")) {
        m_mode = QStringLiteral("screen");
        emit modeChanged();
    }
}

bool IslandAnchor::tryApplyLayerShell()
{
#if DOGSC_HAVE_LAYER_SHELL
    if (!m_window)
        return false;

    QPlatformNativeInterface *native = QGuiApplication::platformNativeInterface();
    if (!native)
        return false;

    auto *display = static_cast<wl_display *>(
        native->nativeResourceForIntegration(QByteArrayLiteral("wl_display")));
    auto *surface = static_cast<wl_surface *>(
        native->nativeResourceForWindow(QByteArrayLiteral("surface"), m_window));
    if (!display || !surface)
        return false;

    static LayerShellState state;
    if (!state.shell) {
        state.registry = wl_display_get_registry(display);
        wl_registry_add_listener(state.registry, &kRegistryListener, &state);
        wl_display_roundtrip(display);
    }
    if (!state.shell)
        return false;

    if (!m_layerSurface) {
        m_layerSurface = zwlr_layer_shell_v1_get_layer_surface(
            state.shell, surface, state.output, ZWLR_LAYER_SHELL_V1_LAYER_TOP,
            "dogsc-recorder-island");
        if (!m_layerSurface)
            return false;
        auto *layer = static_cast<zwlr_layer_surface_v1 *>(m_layerSurface);
        zwlr_layer_surface_v1_add_listener(layer, &kLayerSurfaceListener, this);
        zwlr_layer_surface_v1_set_anchor(
            layer,
            ZWLR_LAYER_SURFACE_V1_ANCHOR_BOTTOM
                | ZWLR_LAYER_SURFACE_V1_ANCHOR_LEFT
                | ZWLR_LAYER_SURFACE_V1_ANCHOR_RIGHT);
        zwlr_layer_surface_v1_set_margin(layer, 0, 0, m_bottomMargin, 0);
        zwlr_layer_surface_v1_set_size(layer, m_window->width(), m_window->height());
        zwlr_layer_surface_v1_set_keyboard_interactivity(
            layer, ZWLR_LAYER_SURFACE_V1_KEYBOARD_INTERACTIVITY_ON_DEMAND);
        wl_surface_commit(surface);
        wl_display_roundtrip(display);
    } else {
        auto *layer = static_cast<zwlr_layer_surface_v1 *>(m_layerSurface);
        zwlr_layer_surface_v1_set_size(layer, m_window->width(), m_window->height());
        zwlr_layer_surface_v1_set_margin(layer, 0, 0, m_bottomMargin, 0);
        wl_surface_commit(surface);
    }

    m_layerShellReady = true;
    return true;
#else
    m_layerShellReady = false;
    return false;
#endif
}

void IslandAnchor::applyScreenAnchor()
{
    if (!m_window)
        return;
    QScreen *screen = m_window->screen();
    if (!screen)
        screen = QGuiApplication::primaryScreen();
    if (!screen)
        return;

    const QRect geo = screen->availableGeometry();
    const int x = geo.x() + (geo.width() - m_window->width()) / 2;
    const int y = geo.y() + geo.height() - m_window->height() - m_bottomMargin;
    m_window->setPosition(x, y);
}
