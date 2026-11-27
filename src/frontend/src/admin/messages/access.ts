import { type Lang } from '../../locale.js';
import type { PermissionKind } from '../grants.js';

export interface AccessMessages {
  heading: string;
  lead: string;
  userId: string;
  find: string;
  hint: string;
  noAccount: string;
  badUserId: string;
  lookupFailed: string;
  grantsOf: string;
  ownAccount: string;
  programs: string;
  noProgramGrants: string;
  columns: { program: string; grantedAt: string; grantedBy: string; actions: string; permission: string; status: string };
  noGranter: string;
  program: string;
  pickProgram: string;
  grantProgram: string;
  programsFailed: string;
  global: string;
  describe: Record<PermissionKind, string>;
  held: (when: string) => string;
  notHeld: string;
  grant: string;
  grantLabel: (permission: string) => string;
  revoke: string;
  revokeLabel: (permission: string) => string;
  programPermission: (program: string) => string;
  granted: (permission: string) => string;
  revoked: (permission: string) => string;
  revokeTitle: string;
  revokeBody: (permission: string) => string;
  revokeOwn: string;
}

export const ACCESS_MESSAGES: Record<Lang, AccessMessages> = {
  vi: {
    heading: 'Phân quyền quản trị',
    lead: 'Cấp và thu hồi quyền theo mã người dùng.',
    userId: 'Mã người dùng',
    find: 'Tìm',
    hint: 'Người cần quyền sao chép mã người dùng của họ ở trang Cài đặt rồi gửi cho bạn. Không tìm được theo tên hay email.',
    noAccount: 'Không có tài khoản nào mang mã này.',
    badUserId: 'Máy chủ không nhận mã này.',
    lookupFailed: 'Chưa tải được quyền của người dùng này.',
    grantsOf: 'Quyền của người dùng',
    ownAccount: 'Tài khoản của bạn',
    programs: 'Quản trị chương trình',
    noProgramGrants: 'Người dùng này chưa quản trị chương trình nào.',
    columns: { program: 'Chương trình', grantedAt: 'Cấp lúc', grantedBy: 'Người cấp', actions: 'Thao tác', permission: 'Quyền', status: 'Trạng thái' },
    noGranter: 'Không ghi (thiết lập ban đầu, hoặc tài khoản đã xóa)',
    program: 'Chương trình',
    pickProgram: 'Chọn chương trình',
    grantProgram: 'Cấp quyền quản trị chương trình',
    programsFailed: 'Chưa tải được danh sách chương trình.',
    global: 'Quyền chung',
    describe: {
      program_admin: 'Sửa nhóm yêu cầu, học phần của nhóm, tiên quyết và kỳ mở của một chương trình được cấp. Không sửa danh mục, không cấp quyền.',
      catalog_maintainer: 'Tạo học phần trong danh mục dùng chung, sửa học phần sau khi xem lại ảnh hưởng, xóa học phần không còn nơi nào dùng. Không sửa chương trình, không cấp quyền.',
      access_manager: 'Cấp và thu hồi cả ba loại quyền, kể cả quyền này. Không tự có quyền sửa chương trình hay danh mục.',
    },
    held: (when) => `Đang có · cấp lúc ${when}`,
    notHeld: 'Chưa có',
    grant: 'Cấp',
    grantLabel: (permission) => `Cấp quyền ${permission}`,
    revoke: 'Thu hồi',
    revokeLabel: (permission) => `Thu hồi quyền ${permission}`,
    programPermission: (program) => `Quản trị chương trình ${program}`,
    granted: (permission) => `Đã cấp quyền “${permission}”.`,
    revoked: (permission) => `Đã thu hồi quyền “${permission}”.`,
    revokeTitle: 'Thu hồi quyền này?',
    revokeBody: (permission) => `Người dùng này sẽ mất quyền “${permission}”. Lần ghi tiếp theo của họ cần quyền đó sẽ bị từ chối.`,
    revokeOwn: 'Đây là tài khoản của bạn: bạn sẽ mất quyền này ngay.',
  },
  en: {
    heading: 'Administration access',
    lead: 'Grant and revoke permissions by user ID.',
    userId: 'User ID',
    find: 'Find',
    hint: 'The person who needs a permission copies their user ID on the Settings page and sends it to you. There is no search by name or email.',
    noAccount: 'No account has this ID.',
    badUserId: 'The server does not accept this ID.',
    lookupFailed: "Could not load this user's permissions.",
    grantsOf: 'Permissions of the user',
    ownAccount: 'Your account',
    programs: 'Program administrator',
    noProgramGrants: 'This user administers no program yet.',
    columns: { program: 'Program', grantedAt: 'Granted', grantedBy: 'Granted by', actions: 'Actions', permission: 'Permission', status: 'Status' },
    noGranter: 'Not recorded (first set-up, or a deleted account)',
    program: 'Program',
    pickProgram: 'Choose a program',
    grantProgram: 'Grant program administrator',
    programsFailed: 'Could not load the programs.',
    global: 'Global permissions',
    describe: {
      program_admin: 'Edits the requirement groups, their courses, the prerequisites and the offering terms of one granted program. No catalog edits, no grants.',
      catalog_maintainer: 'Creates courses in the shared catalog, corrects a course after reviewing its impact, deletes a course nothing uses. No curriculum edits, no grants.',
      access_manager: 'Grants and revokes all three permissions, this one included. It gives no right to edit a curriculum or the catalog.',
    },
    held: (when) => `Held · granted ${when}`,
    notHeld: 'Not held',
    grant: 'Grant',
    grantLabel: (permission) => `Grant the permission ${permission}`,
    revoke: 'Revoke',
    revokeLabel: (permission) => `Revoke the permission ${permission}`,
    programPermission: (program) => `Program administrator of ${program}`,
    granted: (permission) => `Granted the permission “${permission}”.`,
    revoked: (permission) => `Revoked the permission “${permission}”.`,
    revokeTitle: 'Revoke this permission?',
    revokeBody: (permission) => `This user will lose the permission “${permission}”. Their next write that needs it will be refused.`,
    revokeOwn: 'This is your own account: you lose the permission at once.',
  },
};
