import { readFileSync } from 'node:fs';

export interface UbigeoDistrict {
  codigo: string;
  nombre: string;
}
export interface UbigeoProvince extends UbigeoDistrict {
  distritos: UbigeoDistrict[];
}
export interface UbigeoDepartment extends UbigeoDistrict {
  provincias: UbigeoProvince[];
}
export interface UbigeoCatalog {
  departamentos: UbigeoDepartment[];
}

export const ubigeoCatalog = JSON.parse(
  readFileSync(
    new URL('./data/ubigeo_peru_2016.json', import.meta.url),
    'utf8',
  ),
) as UbigeoCatalog;

export const ubigeoLocations = new Map(
  ubigeoCatalog.departamentos.flatMap((department) =>
    department.provincias.flatMap((province) =>
      province.distritos.map(
        (district) =>
          [
            district.codigo,
            {
              department: department.nombre,
              province: province.nombre,
              district: district.nombre,
            },
          ] as const,
      ),
    ),
  ),
);
