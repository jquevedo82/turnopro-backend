import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SubmitReviewDto } from './submit-review.dto';

const build = (overrides = {}) =>
  plainToInstance(SubmitReviewDto, { rating: 5, comment: 'Muy buena atención', ...overrides });

describe('SubmitReviewDto', () => {
  it('acepta un rating de 1 a 5 con comentario', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('rechaza rating fuera de rango', async () => {
    const errors = await validate(build({ rating: 6 }));
    expect(errors.find((e) => e.property === 'rating')).toBeDefined();
  });

  it('rechaza rating 0', async () => {
    const errors = await validate(build({ rating: 0 }));
    expect(errors.find((e) => e.property === 'rating')).toBeDefined();
  });

  it('rechaza comentario de más de 1000 caracteres', async () => {
    const errors = await validate(build({ comment: 'a'.repeat(1001) }));
    expect(errors.find((e) => e.property === 'comment')).toBeDefined();
  });
});
