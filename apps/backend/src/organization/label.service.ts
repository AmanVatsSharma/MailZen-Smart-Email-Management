import { Injectable, NotFoundException } from '@nestjs/common';
import { Label } from './label.entity';
import { CreateLabelInput } from './dto/create-label.input';

@Injectable()
export class LabelService {
  private labels: Label[] = [];
  private idCounter = 1;

  createLabel(createLabelInput: CreateLabelInput): Label {
    const label: Label = {
      id: String(this.idCounter++),
      name: createLabelInput.name,
      color: createLabelInput.color
    };
    this.labels.push(label);
    return label;
  }

  getAllLabels(): Label[] {
    return this.labels;
  }

  getLabelById(id: string): Label {
    const label = this.labels.find(label => label.id === id);
    if (!label) {
      throw new NotFoundException(`Label with id ${id} not found`);
    }
    return label;
  }
} 