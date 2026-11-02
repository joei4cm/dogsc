cmake_minimum_required(VERSION 3.21)
project(dogsc_soft_silver_host VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Quick)

qt_add_executable(dogsc_soft_silver_host main.cpp)

target_compile_definitions(dogsc_soft_silver_host PRIVATE
    DOGSC_QML_MAIN="$<TARGET_FILE_DIR:dogsc_soft_silver_host>/main.qml"
)
add_custom_command(TARGET dogsc_soft_silver_host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/main.qml
        $<TARGET_FILE_DIR:dogsc_soft_silver_host>/main.qml
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CMAKE_CURRENT_SOURCE_DIR}/PreviewSurface.qml
        $<TARGET_FILE_DIR:dogsc_soft_silver_host>/PreviewSurface.qml
)

target_link_libraries(dogsc_soft_silver_host PRIVATE Qt6::Quick)

install(TARGETS dogsc_soft_silver_host RUNTIME DESTINATION bin)
