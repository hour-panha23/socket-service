export class CreateAppDto {
  name!: string;
  description?: string;
}

export class UpdateAppDto {
  name?: string;
  description?: string;
}
