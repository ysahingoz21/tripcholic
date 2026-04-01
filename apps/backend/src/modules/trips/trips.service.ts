import { Injectable } from '@nestjs/common';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  create(payload: CreateTripDto) {
    return {
      status: 'pending_implementation' as const,
      message:
        'Trip creation contract is in place, but persistence and route generation orchestration will be completed after Prisma business models are finalized.',
      submitted: payload,
      nextStep: 'Finalize trip-related Prisma models and orchestration flow.',
    };
  }

  findAll() {
    return {
      status: 'pending_implementation' as const,
      message:
        'Trip listing endpoint is reserved and stable, but trip persistence has not been implemented yet.',
      items: [],
      nextStep: 'Back this endpoint with Prisma once trip models are approved.',
    };
  }

  findOne(id: string) {
    return {
      status: 'pending_implementation' as const,
      message:
        'Trip detail endpoint is reserved and stable, but trip persistence has not been implemented yet.',
      tripId: id,
      nextStep: 'Back this endpoint with Prisma once trip models are approved.',
    };
  }

  update(id: string, payload: UpdateTripDto) {
    return {
      status: 'pending_implementation' as const,
      message:
        'Trip update contract is in place, but persistence and optimistic concurrency rules will be added after Prisma business models are finalized.',
      tripId: id,
      submitted: payload,
      nextStep: 'Back this endpoint with Prisma once trip models are approved.',
    };
  }

  remove(id: string) {
    return {
      status: 'pending_implementation' as const,
      message:
        'Trip deletion endpoint is reserved and stable, but persistence has not been implemented yet.',
      tripId: id,
      nextStep: 'Back this endpoint with Prisma once trip models are approved.',
    };
  }
}
