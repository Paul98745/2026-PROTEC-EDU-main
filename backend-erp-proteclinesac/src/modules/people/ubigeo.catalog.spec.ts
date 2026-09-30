import { ubigeoCatalog, ubigeoLocations } from './ubigeo.catalog.js';

describe('Peru 2016 UBIGEO catalog', () => {
  it('contains the complete source with unique codes and consistent parent prefixes', () => {
    const departments = ubigeoCatalog.departamentos;
    const provinces = departments.flatMap((d) => d.provincias);
    const districts = provinces.flatMap((p) => p.distritos);
    expect(departments).toHaveLength(25);
    expect(provinces).toHaveLength(196);
    expect(districts).toHaveLength(1874);
    expect(new Set(departments.map((d) => d.codigo)).size).toBe(25);
    expect(new Set(provinces.map((p) => p.codigo)).size).toBe(196);
    expect(ubigeoLocations.size).toBe(1874);
    for (const department of departments) {
      expect(department.codigo).toMatch(/^\d{2}$/);
      for (const province of department.provincias) {
        expect(province.codigo).toMatch(/^\d{4}$/);
        expect(province.codigo.slice(0, 2)).toBe(department.codigo);
        for (const district of province.distritos) {
          expect(district.codigo).toMatch(/^\d{6}$/);
          expect(district.codigo.slice(0, 4)).toBe(province.codigo);
        }
      }
    }
  });
});
