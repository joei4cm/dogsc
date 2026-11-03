#include "ContinuousCorner.h"
#include "FrameCache.h"
#include "HostBridge.h"
#include "IslandAnchor.h"
#include "PreviewSurfaceItem.h"

#include <QCoreApplication>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickWindow>
#include <QSurfaceFormat>
#include <QUrl>
#include <qqml.h>

static QObject *continuousCornerProvider(QQmlEngine *, QJSEngine *)
{
    return new ContinuousCorner();
}

int main(int argc, char *argv[])
{
    // Prefer Vulkan RHI when the platform has it; Scene Graph falls back to
    // OpenGL / software if Vulkan is unavailable (headless CI, etc.).
    if (qEnvironmentVariableIsEmpty("QSG_RHI_BACKEND"))
        qputenv("QSG_RHI_BACKEND", QByteArrayLiteral("vulkan"));

    QQuickWindow::setDefaultAlphaBuffer(true);

    QSurfaceFormat fmt = QSurfaceFormat::defaultFormat();
    fmt.setAlphaBufferSize(8);
    QSurfaceFormat::setDefaultFormat(fmt);

    QGuiApplication app(argc, argv);
    QGuiApplication::setApplicationName(QStringLiteral("DogSC"));
    QGuiApplication::setOrganizationName(QStringLiteral("DogSC"));

    qmlRegisterType<PreviewSurfaceItem>("DogSC", 1, 0, "PreviewSurface");
    qmlRegisterType<ContinuousPanelItem>("DogSC", 1, 0, "ContinuousPanel");
    qmlRegisterType<IslandAnchor>("DogSC", 1, 0, "IslandAnchor");
    qmlRegisterType<FrameCache>("DogSC", 1, 0, "FrameCache");
    qmlRegisterType<HostBridge>("DogSC", 1, 0, "HostBridge");
    qmlRegisterSingletonType<ContinuousCorner>(
        "DogSC", 1, 0, "ContinuousCorner", continuousCornerProvider);

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(
        QStringLiteral("dogscQtHost"), QStringLiteral("soft-silver"));

    const QUrl url = QUrl::fromLocalFile(QStringLiteral(DOGSC_QML_MAIN));
    QObject::connect(
        &engine, &QQmlApplicationEngine::objectCreationFailed,
        &app, []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);
    engine.load(url);
    return app.exec();
}
