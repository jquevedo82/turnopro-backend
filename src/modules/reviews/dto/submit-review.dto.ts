import { IsInt, IsString, Min, Max, MaxLength } from 'class-validator';

export class SubmitReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MaxLength(1000)
  comment: string;
}
