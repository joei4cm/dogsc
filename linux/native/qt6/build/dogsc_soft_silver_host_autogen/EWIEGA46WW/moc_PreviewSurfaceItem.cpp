/****************************************************************************
** Meta object code from reading C++ file 'PreviewSurfaceItem.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.4.2)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include <memory>
#include "../../../PreviewSurfaceItem.h"
#include <QtCore/qmetatype.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'PreviewSurfaceItem.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 68
#error "This file was generated using the moc from 6.4.2. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

#ifndef Q_CONSTINIT
#define Q_CONSTINIT
#endif

QT_BEGIN_MOC_NAMESPACE
QT_WARNING_PUSH
QT_WARNING_DISABLE_DEPRECATED
namespace {
struct qt_meta_stringdata_PreviewSurfaceItem_t {
    uint offsetsAndSizes[22];
    char stringdata0[19];
    char stringdata1[14];
    char stringdata2[1];
    char stringdata3[16];
    char stringdata4[18];
    char stringdata5[13];
    char stringdata6[6];
    char stringdata7[11];
    char stringdata8[7];
    char stringdata9[9];
    char stringdata10[11];
};
#define QT_MOC_LITERAL(ofs, len) \
    uint(sizeof(qt_meta_stringdata_PreviewSurfaceItem_t::offsetsAndSizes) + ofs), len 
Q_CONSTINIT static const qt_meta_stringdata_PreviewSurfaceItem_t qt_meta_stringdata_PreviewSurfaceItem = {
    {
        QT_MOC_LITERAL(0, 18),  // "PreviewSurfaceItem"
        QT_MOC_LITERAL(19, 13),  // "statusChanged"
        QT_MOC_LITERAL(33, 0),  // ""
        QT_MOC_LITERAL(34, 15),  // "hasFrameChanged"
        QT_MOC_LITERAL(50, 17),  // "emptyColorChanged"
        QT_MOC_LITERAL(68, 12),  // "presentFrame"
        QT_MOC_LITERAL(81, 5),  // "frame"
        QT_MOC_LITERAL(87, 10),  // "clearFrame"
        QT_MOC_LITERAL(98, 6),  // "status"
        QT_MOC_LITERAL(105, 8),  // "hasFrame"
        QT_MOC_LITERAL(114, 10)   // "emptyColor"
    },
    "PreviewSurfaceItem",
    "statusChanged",
    "",
    "hasFrameChanged",
    "emptyColorChanged",
    "presentFrame",
    "frame",
    "clearFrame",
    "status",
    "hasFrame",
    "emptyColor"
};
#undef QT_MOC_LITERAL
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_PreviewSurfaceItem[] = {

 // content:
      10,       // revision
       0,       // classname
       0,    0, // classinfo
       5,   14, // methods
       3,   51, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       3,       // signalCount

 // signals: name, argc, parameters, tag, flags, initial metatype offsets
       1,    0,   44,    2, 0x06,    4 /* Public */,
       3,    0,   45,    2, 0x06,    5 /* Public */,
       4,    0,   46,    2, 0x06,    6 /* Public */,

 // slots: name, argc, parameters, tag, flags, initial metatype offsets
       5,    1,   47,    2, 0x0a,    7 /* Public */,
       7,    0,   50,    2, 0x0a,    9 /* Public */,

 // signals: parameters
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,

 // slots: parameters
    QMetaType::Void, QMetaType::QImage,    6,
    QMetaType::Void,

 // properties: name, type, flags
       8, QMetaType::QString, 0x00015001, uint(0), 0,
       9, QMetaType::Bool, 0x00015001, uint(1), 0,
      10, QMetaType::QColor, 0x00015103, uint(2), 0,

       0        // eod
};

Q_CONSTINIT const QMetaObject PreviewSurfaceItem::staticMetaObject = { {
    QMetaObject::SuperData::link<QQuickItem::staticMetaObject>(),
    qt_meta_stringdata_PreviewSurfaceItem.offsetsAndSizes,
    qt_meta_data_PreviewSurfaceItem,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_PreviewSurfaceItem_t,
        // property 'status'
        QtPrivate::TypeAndForceComplete<QString, std::true_type>,
        // property 'hasFrame'
        QtPrivate::TypeAndForceComplete<bool, std::true_type>,
        // property 'emptyColor'
        QtPrivate::TypeAndForceComplete<QColor, std::true_type>,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<PreviewSurfaceItem, std::true_type>,
        // method 'statusChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'hasFrameChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'emptyColorChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'presentFrame'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        QtPrivate::TypeAndForceComplete<const QImage &, std::false_type>,
        // method 'clearFrame'
        QtPrivate::TypeAndForceComplete<void, std::false_type>
    >,
    nullptr
} };

void PreviewSurfaceItem::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<PreviewSurfaceItem *>(_o);
        (void)_t;
        switch (_id) {
        case 0: _t->statusChanged(); break;
        case 1: _t->hasFrameChanged(); break;
        case 2: _t->emptyColorChanged(); break;
        case 3: _t->presentFrame((*reinterpret_cast< std::add_pointer_t<QImage>>(_a[1]))); break;
        case 4: _t->clearFrame(); break;
        default: ;
        }
    } else if (_c == QMetaObject::IndexOfMethod) {
        int *result = reinterpret_cast<int *>(_a[0]);
        {
            using _t = void (PreviewSurfaceItem::*)();
            if (_t _q_method = &PreviewSurfaceItem::statusChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 0;
                return;
            }
        }
        {
            using _t = void (PreviewSurfaceItem::*)();
            if (_t _q_method = &PreviewSurfaceItem::hasFrameChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 1;
                return;
            }
        }
        {
            using _t = void (PreviewSurfaceItem::*)();
            if (_t _q_method = &PreviewSurfaceItem::emptyColorChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 2;
                return;
            }
        }
    }else if (_c == QMetaObject::ReadProperty) {
        auto *_t = static_cast<PreviewSurfaceItem *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 0: *reinterpret_cast< QString*>(_v) = _t->status(); break;
        case 1: *reinterpret_cast< bool*>(_v) = _t->hasFrame(); break;
        case 2: *reinterpret_cast< QColor*>(_v) = _t->emptyColor(); break;
        default: break;
        }
    } else if (_c == QMetaObject::WriteProperty) {
        auto *_t = static_cast<PreviewSurfaceItem *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 2: _t->setEmptyColor(*reinterpret_cast< QColor*>(_v)); break;
        default: break;
        }
    } else if (_c == QMetaObject::ResetProperty) {
    } else if (_c == QMetaObject::BindableProperty) {
    }
}

const QMetaObject *PreviewSurfaceItem::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *PreviewSurfaceItem::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_PreviewSurfaceItem.stringdata0))
        return static_cast<void*>(this);
    return QQuickItem::qt_metacast(_clname);
}

int PreviewSurfaceItem::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QQuickItem::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 5)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 5;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 5)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 5;
    }else if (_c == QMetaObject::ReadProperty || _c == QMetaObject::WriteProperty
            || _c == QMetaObject::ResetProperty || _c == QMetaObject::BindableProperty
            || _c == QMetaObject::RegisterPropertyMetaType) {
        qt_static_metacall(this, _c, _id, _a);
        _id -= 3;
    }
    return _id;
}

// SIGNAL 0
void PreviewSurfaceItem::statusChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 0, nullptr);
}

// SIGNAL 1
void PreviewSurfaceItem::hasFrameChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 1, nullptr);
}

// SIGNAL 2
void PreviewSurfaceItem::emptyColorChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 2, nullptr);
}
QT_WARNING_POP
QT_END_MOC_NAMESPACE
