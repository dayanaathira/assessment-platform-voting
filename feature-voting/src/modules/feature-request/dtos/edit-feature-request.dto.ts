import { PartialType } from '@nestjs/swagger';
import { AddFeatureRequestDto } from './add-feature-request.dto';

export class EditFeatureRequestDto extends PartialType(AddFeatureRequestDto) {}
