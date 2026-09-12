/**
 * Account deletion.
 *
 * What is worth pinning down is the order. The database goes first so that a failure there leaves
 * an account the user can still sign in to and retry with; deleting the auth user first would
 * leave a wallet under a uid nobody can ever authenticate as, and so nobody can ever clear.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('firebase-functions', () => ({
    logger: { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

/** Every call either side makes, in the order it was made. */
const calls = [];

const removeMock = vi.fn(async () => { calls.push('database'); });
const deleteUserMock = vi.fn(async () => { calls.push('auth'); });

vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({ ref: (path) => ({ path, remove: () => removeMock(path) }) })),
}));

vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({ deleteUser: (uid) => deleteUserMock(uid) })),
}));

const { deleteAccount } = await import('../utils/account.js');

describe('deleteAccount', () => {
    beforeEach(() => {
        calls.length = 0;
        removeMock.mockClear().mockImplementation(async () => { calls.push('database'); });
        deleteUserMock.mockClear().mockImplementation(async () => { calls.push('auth'); });
    });

    it('removes the wallet subtree and the auth user', async () => {
        await deleteAccount('alice');

        expect(removeMock).toHaveBeenCalledWith('users/alice');
        expect(deleteUserMock).toHaveBeenCalledWith('alice');
    });

    it('clears the database before the auth user', async () => {
        await deleteAccount('alice');

        expect(calls).toEqual(['database', 'auth']);
    });

    it('leaves the account signed-in-able when the database remove fails', async () => {
        removeMock.mockRejectedValueOnce(new Error('permission denied'));

        await expect(deleteAccount('alice')).rejects.toThrow('permission denied');
        expect(deleteUserMock).not.toHaveBeenCalled();
    });

    it('surfaces an auth failure rather than reporting success', async () => {
        deleteUserMock.mockRejectedValueOnce(new Error('user not found'));

        await expect(deleteAccount('alice')).rejects.toThrow('user not found');
    });
});
