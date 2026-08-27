import { getVerticalConfig, VERTICAL_CONFIG } from './verticals';
import { ProfessionalType } from '../modules/professionals/professional-type.enum';

describe('getVerticalConfig', () => {
  it('HEALTH → Paciente / Cita / Estimado/a', () => {
    const vc = getVerticalConfig(ProfessionalType.HEALTH);
    expect(vc.clientLabel).toBe('Paciente');
    expect(vc.clientLabelPlural).toBe('Pacientes');
    expect(vc.appointmentLabel).toBe('Cita');
    expect(vc.emailGreeting).toBe('Estimado/a');
  });

  it('BEAUTY → Cliente / Turno / Hola', () => {
    const vc = getVerticalConfig(ProfessionalType.BEAUTY);
    expect(vc.clientLabel).toBe('Cliente');
    expect(vc.appointmentLabel).toBe('Turno');
    expect(vc.emailGreeting).toBe('Hola');
  });

  it('WELLNESS → Cliente / Sesión', () => {
    const vc = getVerticalConfig(ProfessionalType.WELLNESS);
    expect(vc.clientLabel).toBe('Cliente');
    expect(vc.appointmentLabel).toBe('Sesión');
  });

  it('OTHER → Cliente / Turno', () => {
    const vc = getVerticalConfig(ProfessionalType.OTHER);
    expect(vc.clientLabel).toBe('Cliente');
    expect(vc.appointmentLabel).toBe('Turno');
  });

  it('undefined → fallback a HEALTH', () => {
    const vc = getVerticalConfig(undefined);
    expect(vc.clientLabel).toBe('Paciente');
  });

  it('tipo desconocido → fallback a HEALTH', () => {
    const vc = getVerticalConfig('tipo-inexistente');
    expect(vc.clientLabel).toBe('Paciente');
  });

  it('todos los verticales tienen los campos requeridos', () => {
    const requiredFields = ['clientLabel', 'clientLabelPlural', 'appointmentLabel', 'appointmentLabelPlural', 'emailGreeting', 'emailSignoff', 'reviewerNameDisplay'];
    Object.values(VERTICAL_CONFIG).forEach((vc) => {
      requiredFields.forEach((field) => {
        expect(vc).toHaveProperty(field);
        expect((vc as any)[field]).toBeTruthy();
      });
    });
  });

  it('solo HEALTH usa iniciales en reseñas públicas — el resto muestra el nombre completo', () => {
    expect(getVerticalConfig(ProfessionalType.HEALTH).reviewerNameDisplay).toBe('initials');
    expect(getVerticalConfig(ProfessionalType.BEAUTY).reviewerNameDisplay).toBe('full');
    expect(getVerticalConfig(ProfessionalType.WELLNESS).reviewerNameDisplay).toBe('full');
    expect(getVerticalConfig(ProfessionalType.OTHER).reviewerNameDisplay).toBe('full');
  });
});
