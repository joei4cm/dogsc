/****************************************************************************
** Meta object code from reading C++ file 'ContinuousCorner.h'
**
** Created by: The Qt Meta Object Compiler version 68 (Qt 6.4.2)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include <memory>
#include "../../../ContinuousCorner.h"
#include <QtCore/qmetatype.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'ContinuousCorner.h' doesn't include <QObject>."
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
struct qt_meta_stringdata_ContinuousCorner_t {
    uint offsetsAndSizes[26];
    char stringdata0[17];
    char stringdata1[5];
    char stringdata2[13];
    char stringdata3[1];
    char stringdata4[2];
    char stringdata5[2];
    char stringdata6[2];
    char stringdata7[2];
    char stringdata8[7];
    char stringdata9[11];
    char stringdata10[5];
    char stringdata11[6];
    char stringdata12[7];
};
#define QT_MOC_LITERAL(ofs, len) \
    uint(sizeof(qt_meta_stringdata_ContinuousCorner_t::offsetsAndSizes) + ofs), len 
Q_CONSTINIT static const qt_meta_stringdata_ContinuousCorner_t qt_meta_stringdata_ContinuousCorner = {
    {
        QT_MOC_LITERAL(0, 16),  // "ContinuousCorner"
        QT_MOC_LITERAL(17, 4),  // "path"
        QT_MOC_LITERAL(22, 12),  // "QPainterPath"
        QT_MOC_LITERAL(35, 0),  // ""
        QT_MOC_LITERAL(36, 1),  // "x"
        QT_MOC_LITERAL(38, 1),  // "y"
        QT_MOC_LITERAL(40, 1),  // "w"
        QT_MOC_LITERAL(42, 1),  // "h"
        QT_MOC_LITERAL(44, 6),  // "radius"
        QT_MOC_LITERAL(51, 10),  // "smoothness"
        QT_MOC_LITERAL(62, 4),  // "mask"
        QT_MOC_LITERAL(67, 5),  // "width"
        QT_MOC_LITERAL(73, 6)   // "height"
    },
    "ContinuousCorner",
    "path",
    "QPainterPath",
    "",
    "x",
    "y",
    "w",
    "h",
    "radius",
    "smoothness",
    "mask",
    "width",
    "height"
};
#undef QT_MOC_LITERAL
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_ContinuousCorner[] = {

 // content:
      10,       // revision
       0,       // classname
       0,    0, // classinfo
       4,   14, // methods
       0,    0, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       0,       // signalCount

 // methods: name, argc, parameters, tag, flags, initial metatype offsets
       1,    6,   38,    3, 0x102,    1 /* Public | MethodIsConst  */,
       1,    5,   51,    3, 0x122,    8 /* Public | MethodCloned | MethodIsConst  */,
      10,    4,   62,    3, 0x102,   14 /* Public | MethodIsConst  */,
      10,    3,   71,    3, 0x122,   19 /* Public | MethodCloned | MethodIsConst  */,

 // methods: parameters
    0x80000000 | 2, QMetaType::QReal, QMetaType::QReal, QMetaType::QReal, QMetaType::QReal, QMetaType::QReal, QMetaType::QReal,    4,    5,    6,    7,    8,    9,
    0x80000000 | 2, QMetaType::QReal, QMetaType::QReal, QMetaType::QReal, QMetaType::QReal, QMetaType::QReal,    4,    5,    6,    7,    8,
    QMetaType::QImage, QMetaType::Int, QMetaType::Int, QMetaType::QReal, QMetaType::QReal,   11,   12,    8,    9,
    QMetaType::QImage, QMetaType::Int, QMetaType::Int, QMetaType::QReal,   11,   12,    8,

       0        // eod
};

Q_CONSTINIT const QMetaObject ContinuousCorner::staticMetaObject = { {
    QMetaObject::SuperData::link<QObject::staticMetaObject>(),
    qt_meta_stringdata_ContinuousCorner.offsetsAndSizes,
    qt_meta_data_ContinuousCorner,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_ContinuousCorner_t,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<ContinuousCorner, std::true_type>,
        // method 'path'
        QtPrivate::TypeAndForceComplete<QPainterPath, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        // method 'path'
        QtPrivate::TypeAndForceComplete<QPainterPath, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        // method 'mask'
        QtPrivate::TypeAndForceComplete<QImage, std::false_type>,
        QtPrivate::TypeAndForceComplete<int, std::false_type>,
        QtPrivate::TypeAndForceComplete<int, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>,
        // method 'mask'
        QtPrivate::TypeAndForceComplete<QImage, std::false_type>,
        QtPrivate::TypeAndForceComplete<int, std::false_type>,
        QtPrivate::TypeAndForceComplete<int, std::false_type>,
        QtPrivate::TypeAndForceComplete<qreal, std::false_type>
    >,
    nullptr
} };

void ContinuousCorner::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<ContinuousCorner *>(_o);
        (void)_t;
        switch (_id) {
        case 0: { QPainterPath _r = _t->path((*reinterpret_cast< std::add_pointer_t<qreal>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[2])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[3])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[4])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[5])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[6])));
            if (_a[0]) *reinterpret_cast< QPainterPath*>(_a[0]) = std::move(_r); }  break;
        case 1: { QPainterPath _r = _t->path((*reinterpret_cast< std::add_pointer_t<qreal>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[2])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[3])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[4])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[5])));
            if (_a[0]) *reinterpret_cast< QPainterPath*>(_a[0]) = std::move(_r); }  break;
        case 2: { QImage _r = _t->mask((*reinterpret_cast< std::add_pointer_t<int>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<int>>(_a[2])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[3])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[4])));
            if (_a[0]) *reinterpret_cast< QImage*>(_a[0]) = std::move(_r); }  break;
        case 3: { QImage _r = _t->mask((*reinterpret_cast< std::add_pointer_t<int>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<int>>(_a[2])),(*reinterpret_cast< std::add_pointer_t<qreal>>(_a[3])));
            if (_a[0]) *reinterpret_cast< QImage*>(_a[0]) = std::move(_r); }  break;
        default: ;
        }
    }
}

const QMetaObject *ContinuousCorner::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *ContinuousCorner::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_ContinuousCorner.stringdata0))
        return static_cast<void*>(this);
    return QObject::qt_metacast(_clname);
}

int ContinuousCorner::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QObject::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 4)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 4;
    } else if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 4)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 4;
    }
    return _id;
}
namespace {
struct qt_meta_stringdata_ContinuousPanelItem_t {
    uint offsetsAndSizes[24];
    char stringdata0[20];
    char stringdata1[13];
    char stringdata2[1];
    char stringdata3[19];
    char stringdata4[19];
    char stringdata5[14];
    char stringdata6[18];
    char stringdata7[6];
    char stringdata8[12];
    char stringdata9[12];
    char stringdata10[7];
    char stringdata11[11];
};
#define QT_MOC_LITERAL(ofs, len) \
    uint(sizeof(qt_meta_stringdata_ContinuousPanelItem_t::offsetsAndSizes) + ofs), len 
Q_CONSTINIT static const qt_meta_stringdata_ContinuousPanelItem_t qt_meta_stringdata_ContinuousPanelItem = {
    {
        QT_MOC_LITERAL(0, 19),  // "ContinuousPanelItem"
        QT_MOC_LITERAL(20, 12),  // "colorChanged"
        QT_MOC_LITERAL(33, 0),  // ""
        QT_MOC_LITERAL(34, 18),  // "borderColorChanged"
        QT_MOC_LITERAL(53, 18),  // "borderWidthChanged"
        QT_MOC_LITERAL(72, 13),  // "radiusChanged"
        QT_MOC_LITERAL(86, 17),  // "smoothnessChanged"
        QT_MOC_LITERAL(104, 5),  // "color"
        QT_MOC_LITERAL(110, 11),  // "borderColor"
        QT_MOC_LITERAL(122, 11),  // "borderWidth"
        QT_MOC_LITERAL(134, 6),  // "radius"
        QT_MOC_LITERAL(141, 10)   // "smoothness"
    },
    "ContinuousPanelItem",
    "colorChanged",
    "",
    "borderColorChanged",
    "borderWidthChanged",
    "radiusChanged",
    "smoothnessChanged",
    "color",
    "borderColor",
    "borderWidth",
    "radius",
    "smoothness"
};
#undef QT_MOC_LITERAL
} // unnamed namespace

Q_CONSTINIT static const uint qt_meta_data_ContinuousPanelItem[] = {

 // content:
      10,       // revision
       0,       // classname
       0,    0, // classinfo
       5,   14, // methods
       5,   49, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       5,       // signalCount

 // signals: name, argc, parameters, tag, flags, initial metatype offsets
       1,    0,   44,    2, 0x06,    6 /* Public */,
       3,    0,   45,    2, 0x06,    7 /* Public */,
       4,    0,   46,    2, 0x06,    8 /* Public */,
       5,    0,   47,    2, 0x06,    9 /* Public */,
       6,    0,   48,    2, 0x06,   10 /* Public */,

 // signals: parameters
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,
    QMetaType::Void,

 // properties: name, type, flags
       7, QMetaType::QColor, 0x00015103, uint(0), 0,
       8, QMetaType::QColor, 0x00015103, uint(1), 0,
       9, QMetaType::QReal, 0x00015103, uint(2), 0,
      10, QMetaType::QReal, 0x00015103, uint(3), 0,
      11, QMetaType::QReal, 0x00015103, uint(4), 0,

       0        // eod
};

Q_CONSTINIT const QMetaObject ContinuousPanelItem::staticMetaObject = { {
    QMetaObject::SuperData::link<QQuickPaintedItem::staticMetaObject>(),
    qt_meta_stringdata_ContinuousPanelItem.offsetsAndSizes,
    qt_meta_data_ContinuousPanelItem,
    qt_static_metacall,
    nullptr,
    qt_incomplete_metaTypeArray<qt_meta_stringdata_ContinuousPanelItem_t,
        // property 'color'
        QtPrivate::TypeAndForceComplete<QColor, std::true_type>,
        // property 'borderColor'
        QtPrivate::TypeAndForceComplete<QColor, std::true_type>,
        // property 'borderWidth'
        QtPrivate::TypeAndForceComplete<qreal, std::true_type>,
        // property 'radius'
        QtPrivate::TypeAndForceComplete<qreal, std::true_type>,
        // property 'smoothness'
        QtPrivate::TypeAndForceComplete<qreal, std::true_type>,
        // Q_OBJECT / Q_GADGET
        QtPrivate::TypeAndForceComplete<ContinuousPanelItem, std::true_type>,
        // method 'colorChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'borderColorChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'borderWidthChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'radiusChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>,
        // method 'smoothnessChanged'
        QtPrivate::TypeAndForceComplete<void, std::false_type>
    >,
    nullptr
} };

void ContinuousPanelItem::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    if (_c == QMetaObject::InvokeMetaMethod) {
        auto *_t = static_cast<ContinuousPanelItem *>(_o);
        (void)_t;
        switch (_id) {
        case 0: _t->colorChanged(); break;
        case 1: _t->borderColorChanged(); break;
        case 2: _t->borderWidthChanged(); break;
        case 3: _t->radiusChanged(); break;
        case 4: _t->smoothnessChanged(); break;
        default: ;
        }
    } else if (_c == QMetaObject::IndexOfMethod) {
        int *result = reinterpret_cast<int *>(_a[0]);
        {
            using _t = void (ContinuousPanelItem::*)();
            if (_t _q_method = &ContinuousPanelItem::colorChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 0;
                return;
            }
        }
        {
            using _t = void (ContinuousPanelItem::*)();
            if (_t _q_method = &ContinuousPanelItem::borderColorChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 1;
                return;
            }
        }
        {
            using _t = void (ContinuousPanelItem::*)();
            if (_t _q_method = &ContinuousPanelItem::borderWidthChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 2;
                return;
            }
        }
        {
            using _t = void (ContinuousPanelItem::*)();
            if (_t _q_method = &ContinuousPanelItem::radiusChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 3;
                return;
            }
        }
        {
            using _t = void (ContinuousPanelItem::*)();
            if (_t _q_method = &ContinuousPanelItem::smoothnessChanged; *reinterpret_cast<_t *>(_a[1]) == _q_method) {
                *result = 4;
                return;
            }
        }
    }else if (_c == QMetaObject::ReadProperty) {
        auto *_t = static_cast<ContinuousPanelItem *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 0: *reinterpret_cast< QColor*>(_v) = _t->color(); break;
        case 1: *reinterpret_cast< QColor*>(_v) = _t->borderColor(); break;
        case 2: *reinterpret_cast< qreal*>(_v) = _t->borderWidth(); break;
        case 3: *reinterpret_cast< qreal*>(_v) = _t->radius(); break;
        case 4: *reinterpret_cast< qreal*>(_v) = _t->smoothness(); break;
        default: break;
        }
    } else if (_c == QMetaObject::WriteProperty) {
        auto *_t = static_cast<ContinuousPanelItem *>(_o);
        (void)_t;
        void *_v = _a[0];
        switch (_id) {
        case 0: _t->setColor(*reinterpret_cast< QColor*>(_v)); break;
        case 1: _t->setBorderColor(*reinterpret_cast< QColor*>(_v)); break;
        case 2: _t->setBorderWidth(*reinterpret_cast< qreal*>(_v)); break;
        case 3: _t->setRadius(*reinterpret_cast< qreal*>(_v)); break;
        case 4: _t->setSmoothness(*reinterpret_cast< qreal*>(_v)); break;
        default: break;
        }
    } else if (_c == QMetaObject::ResetProperty) {
    } else if (_c == QMetaObject::BindableProperty) {
    }
    (void)_a;
}

const QMetaObject *ContinuousPanelItem::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *ContinuousPanelItem::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_meta_stringdata_ContinuousPanelItem.stringdata0))
        return static_cast<void*>(this);
    return QQuickPaintedItem::qt_metacast(_clname);
}

int ContinuousPanelItem::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QQuickPaintedItem::qt_metacall(_c, _id, _a);
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
        _id -= 5;
    }
    return _id;
}

// SIGNAL 0
void ContinuousPanelItem::colorChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 0, nullptr);
}

// SIGNAL 1
void ContinuousPanelItem::borderColorChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 1, nullptr);
}

// SIGNAL 2
void ContinuousPanelItem::borderWidthChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 2, nullptr);
}

// SIGNAL 3
void ContinuousPanelItem::radiusChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 3, nullptr);
}

// SIGNAL 4
void ContinuousPanelItem::smoothnessChanged()
{
    QMetaObject::activate(this, &staticMetaObject, 4, nullptr);
}
QT_WARNING_POP
QT_END_MOC_NAMESPACE
