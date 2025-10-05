# 📊 Sistema de Venta por Peso (Tanto)

## ¿Cómo funciona?

El sistema de **venta por peso** permite vender productos a granel por kilogramos, cobrando automáticamente según el precio base por kg del producto.

## 🔍 Búsqueda Automática del Precio por Kg

Cuando activas la venta por peso, el sistema busca el precio en el siguiente orden de prioridad:

### 1. **Presentación "Kg suelto" (Recomendado)**
   - Busca una presentación con:
     - `unidad: "kg"`
     - `factor_a_base: 1`
   - Esta es la presentación base 1:1 con el stock

### 2. **Presentación por defecto en kg**
   - Si no existe la anterior, busca:
     - `unidad: "kg"`
     - `es_default: true`

### 3. **Primera presentación en kg**
   - Como último recurso, toma la primera presentación que encuentre con `unidad: "kg"`

## ✅ Configuración Recomendada

Para que la venta por peso funcione correctamente, **cada producto que se venda por peso debe tener**:

### Ejemplo de Presentación "Kg suelto":
```javascript
{
  nombre: "Kg suelto",
  unidad: "kg",
  factor_a_base: 1,
  precio_unitario: 35.00,
  es_default: true
}
```

## 📝 Ejemplo Práctico

### Producto: Alpiste

**Presentaciones:**
1. **Kg suelto** - $35.00/kg (factor: 1) ← **Se usa este precio**
2. Bulto 25kg - $850.00 (factor: 25)

**Venta por peso:**
- Cliente compra: **2.5 kg**
- Precio base: **$35.00/kg**
- Total: **$87.50**

## 🎯 Ventajas del Sistema

1. **Automático**: No necesitas seleccionar presentación
2. **Flexible**: Acepta decimales (ej: 1.5 kg, 0.75 kg)
3. **Preciso**: Calcula el precio exacto según el peso
4. **Visual**: Muestra el precio base antes de agregar al carrito

## ⚠️ Importante

- Solo productos con `unidad_base: "kg"` pueden venderse por peso
- El toggle de "Vender por peso (tanto)" solo aparece para estos productos
- Si un producto no tiene precio por kg, el sistema mostrará un error claro

## 🛠️ Verificación en la Base de Datos

Para verificar que tus productos tienen la configuración correcta:

```sql
-- Ver presentaciones en kg de todos los productos
SELECT 
  p.nombre as producto,
  pr.nombre as presentacion,
  pr.unidad,
  pr.factor_a_base,
  pr.precio_unitario,
  pr.es_default
FROM Productos p
JOIN Presentaciones_producto pr ON p.id = pr.producto_id
WHERE pr.unidad = 'kg'
ORDER BY p.nombre;
```

## 📋 Seed Data de Ejemplo

El archivo `seed.ts` ya incluye ejemplos correctos:

```typescript
{
  producto_id: alpiste.id,
  nombre: "Kg suelto",
  unidad: Unidad.kg,
  factor_a_base: 1,
  precio_unitario: 35.0,
  es_default: true,
}
```

## 🎨 Interfaz de Usuario

Cuando seleccionas un producto que puede venderse por peso:

1. **Aparece un toggle** "Vender por peso (tanto)"
2. **Se muestra el precio base** en un recuadro destacado
3. **Al activarlo**, cambia el formulario para ingresar kilogramos
4. **Calcula en tiempo real** el subtotal según el peso ingresado

## 💡 Consejos

- Usa nombres claros como "Kg suelto", "Por kilo", "Granel"
- Mantén el `factor_a_base: 1` para la presentación base
- Marca como `es_default: true` la presentación más común
- El precio por kg debe reflejar el costo real del producto a granel
