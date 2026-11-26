import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { GuideDto, GuideListDto } from './guides.dto.js';
import { GuidesService } from './guides.service.js';

@ApiTags('guides')
@Controller('guides')
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: GuideListDto, description: 'Every published guide, in each language it is published in. No sign-in needed.' })
  async list(): Promise<GuideListDto> {
    return { guides: await this.guides.list() };
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: GuideDto, description: 'One published guide. No sign-in needed.' })
  @ApiNotFoundResponse({ description: 'No published guide has this id. Drafts and withdrawn guides get the same answer.' })
  get(@Param('id') id: string): Promise<GuideDto> {
    return this.guides.get(id);
  }
}
