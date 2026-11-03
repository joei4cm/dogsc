cmake_minimum_required(VERSION 3.21)
project(dogsc_soft_silver_host VERSION 0.3 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Gui Quick ShaderTools)
find_package(PkgConfig)
pkg_check_modules(WAYLAND_CLIENT IMPORTED_TARGET wayland-client)

qt_add_executable(dogsc_soft_silver_host
    main.cpp
    PreviewSurfaceItem.cpp
    PreviewSurfaceItem.h
    ContinuousCorner.cpp
    ContinuousCorner.h
    IslandAnchor.cpp
    IslandAnchor.h
)

# Bake Soft Silver continuous-corner SDF shaders (G04).
qt6_add_shaders(dogsc_soft_silver_host "dogsc_shaders"
    BATCHABLE
    PRECOMPILE
    PREFIX "/dogsc"
    FILES
        shaders/continuous_corner.vert
        shaders/continuous_corner.frag
)

# Optional Wayland layer-shell (G03) — generated when wayland-client is present.
if(WAYLAND_CLIENT_FOUND)
    find_program(WAYLAND_SCANNER wayland-scanner REQUIRED)
    set(_layer_xml ${CMAKE_CURRENT_SOURCE_DIR}/protocols/wlr-layer-shell-unstable-v1.xml)
    set(_xdg_xml /usr/share/wayland-protocols/stable/xdg-shell/xdg-shell.xml)
    set(_layer_hdr ${CMAKE_CURRENT_BINARY_DIR}/wlr-layer-shell-unstable-v1-client-protocol.h)
    set(_layer_src ${CMAKE_CURRENT_BINARY_DIR}/wlr-layer-shell-unstable-v1-protocol.c)
    set(_xdg_hdr ${CMAKE_CURRENT_BINARY_DIR}/xdg-shell-client-protocol.h)
    set(_xdg_src ${CMAKE_CURRENT_BINARY_DIR}/xdg-shell-protocol.c)
    add_custom_command(
        OUTPUT ${_layer_hdr} ${_layer_src} ${_xdg_hdr} ${_xdg_src}
        COMMAND ${WAYLAND_SCANNER} client-header ${_layer_xml} ${_layer_hdr}
        COMMAND ${WAYLAND_SCANNER} private-code ${_layer_xml} ${_layer_src}
        COMMAND ${WAYLAND_SCANNER} client-header ${_xdg_xml} ${_xdg_hdr}
        COMMAND ${WAYLAND_SCANNER} private-code ${_xdg_xml} ${_xdg_src}
        DEPENDS ${_layer_xml} ${_xdg_xml}
        COMMENT "Generate wlr-layer-shell + xdg-shell client protocols"
        VERBATIM
    )
    target_sources(dogsc_soft_silver_host PRIVATE
        ${_layer_src} ${_layer_hdr} ${_xdg_src} ${_xdg_hdr})
    target_include_directories(dogsc_soft_silver_host PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
    target_link_libraries(dogsc_soft_silver_host PRIVATE PkgConfig::WAYLAND_CLIENT)
    target_compile_definitions(dogsc_soft_silver_host PRIVATE DOGSC_HAS_WAYLAND_CLIENT=1)
endif()

target_compile_definitions(dogsc_soft_silver_host PRIVATE
    DOGSC_QML_MAIN="$<TARGET_FILE_DIR:dogsc_soft_silver_host>/main.qml"
)

set(_dogsc_qml_files
    ${CMAKE_CURRENT_SOURCE_DIR}/main.qml
    ${CMAKE_CURRENT_SOURCE_DIR}/PreviewSurface.qml
    ${CMAKE_CURRENT_SOURCE_DIR}/RecorderIsland.qml
    ${CMAKE_CURRENT_SOURCE_DIR}/ContinuousSdfPanel.qml
)

add_custom_command(TARGET dogsc_soft_silver_host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/main.qml
        $<TARGET_FILE_DIR:dogsc_soft_silver_host>/main.qml
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/PreviewSurface.qml
        $<TARGET_FILE_DIR:dogsc_soft_silver_host>/PreviewSurface.qml
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/RecorderIsland.qml
        $<TARGET_FILE_DIR:dogsc_soft_silver_host>/RecorderIsland.qml
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/ContinuousSdfPanel.qml
        $<TARGET_FILE_DIR:dogsc_soft_silver_host>/ContinuousSdfPanel.qml
)

# QPA native interface (wl_surface / wl_display) for layer-shell (G03).
target_include_directories(dogsc_soft_silver_host PRIVATE
    ${Qt6Gui_INCLUDE_DIRS}
    ${Qt6Gui_PRIVATE_INCLUDE_DIRS}
    /usr/include/x86_64-linux-gnu/qt6/QtGui/${Qt6Gui_VERSION}
)
target_link_libraries(dogsc_soft_silver_host PRIVATE Qt6::Gui Qt6::Quick)

install(TARGETS dogsc_soft_silver_host RUNTIME DESTINATION bin)
install(FILES ${_dogsc_qml_files} DESTINATION share/dogsc/qt6)
