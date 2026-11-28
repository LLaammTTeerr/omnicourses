import { getMetadataArgsStorage, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

describe('User entity metadata', () => {
  it('excludes passwordHash from default selections so request.user never carries it', () => {
    const passwordColumn = getMetadataArgsStorage().columns.find(
      (column) => column.target === User && column.propertyName === 'passwordHash',
    );
    expect(passwordColumn?.options.name).toBe('password_hash');
    expect(passwordColumn?.options.select).toBe(false);
  });
});

describe('UsersService', () => {
  let queryBuilder: {
    select: ReturnType<typeof vi.fn>;
    addSelect: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    getOne: ReturnType<typeof vi.fn>;
  };
  let repo: {
    findOneBy: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: UsersService;

  beforeEach(() => {
    queryBuilder = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn(async () => null),
    };
    repo = {
      findOneBy: vi.fn(async () => null),
      createQueryBuilder: vi.fn(() => queryBuilder),
      create: vi.fn((fields: Partial<User>) => fields),
      save: vi.fn(async (entity: Partial<User>) => entity),
      update: vi.fn(async () => ({ affected: 1 })),
      find: vi.fn(async () => []),
      delete: vi.fn(async () => ({ affected: 1 })),
    };
    service = new UsersService(repo as unknown as Repository<User>);
  });

  it('findByEmail queries lowercase email without selecting passwordHash', async () => {
    const found = { id: 'u1', email: 'student@example.com' } as User;
    repo.findOneBy.mockResolvedValueOnce(found);
    await expect(service.findByEmail('Student@Example.com')).resolves.toBe(found);
    expect(repo.findOneBy).toHaveBeenCalledWith({ email: 'student@example.com' });
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findByEmailForAuth explicitly selects u.passwordHash for normalized email', async () => {
    const found = { id: 'u1', email: 'student@example.com', passwordHash: '$argon2id$hash' } as User;
    queryBuilder.getOne.mockResolvedValueOnce(found);

    await expect(service.findByEmailForAuth('Student@Example.com')).resolves.toBe(found);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('u.passwordHash');
    expect(queryBuilder.where).toHaveBeenCalledWith('u.email = :email', { email: 'student@example.com' });
  });

  it('findPasswordHash reads u.passwordHash by user id and returns null when absent', async () => {
    queryBuilder.getOne.mockResolvedValueOnce({ id: 'u1', passwordHash: '$argon2id$hash' } as User);
    await expect(service.findPasswordHash('u1')).resolves.toBe('$argon2id$hash');
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('u');
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('u.passwordHash');
    expect(queryBuilder.where).toHaveBeenCalledWith('u.id = :userId', { userId: 'u1' });

    queryBuilder.getOne.mockResolvedValueOnce({ id: 'u2', passwordHash: null } as User);
    await expect(service.findPasswordHash('u2')).resolves.toBeNull();

    queryBuilder.getOne.mockResolvedValueOnce(null);
    await expect(service.findPasswordHash('missing')).resolves.toBeNull();
  });

  it('normalizes email to lowercase on create', async () => {
    const consentAt = new Date('2026-11-27T00:00:00Z');
    const saved = { id: 'u1' } as User;
    repo.save.mockResolvedValueOnce(saved);
    const result = await service.create({
      email: 'Student@Example.com',
      passwordHash: '$argon2id$hash',
      displayName: 'Test Student',
      consentAt,
    });
    expect(repo.create).toHaveBeenCalledWith({
      email: 'student@example.com',
      passwordHash: '$argon2id$hash',
      displayName: 'Test Student',
      consentAt,
    });
    const created = repo.create.mock.results[0]!.value;
    expect(repo.save).toHaveBeenCalledExactlyOnceWith(created);
    expect(result).toBe(saved);
  });
});