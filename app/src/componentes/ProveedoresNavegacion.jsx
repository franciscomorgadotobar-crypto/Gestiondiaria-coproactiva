import { NavLink } from 'react-router-dom';

/* Un solo menú para las cuatro áreas. En escritorio se utiliza el panel lateral;
 * esta barra sirve de navegación compacta en móvil y evita pestañas divergentes. */
const SECCIONES = [
  ['/proveedores', 'Proveedores', true],
  ['/proveedores/postulantes', 'Postulantes', false],
  ['/proveedores/correos', 'Correos', false],
  ['/proveedores/comunicaciones', 'Comunicaciones', false]
];

export default function ProveedoresNavegacion() {
  return (
    <nav className="proveedores-subnav" aria-label="Secciones de proveedores">
      {SECCIONES.map(([ruta, titulo, exacta]) => (
        <NavLink key={ruta} to={ruta} end={exacta}>
          {titulo}
        </NavLink>
      ))}
    </nav>
  );
}
