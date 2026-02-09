import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../lib/api';
import { User, UserRole } from '../types';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { getTimezoneDisplay, getCountryDisplay } from '../lib/geolocation';

type SortField = 'email' | 'name' | 'role' | 'createdAt' | 'lastSeenAt' | 'timezone' | 'country' | 'tickets';
type SortDirection = 'asc' | 'desc';

// SortIcon component moved outside to prevent re-creation
const SortIcon: React.FC<{ field: SortField; sortField: SortField; sortDirection: SortDirection }> = ({ field, sortField, sortDirection }) => {
  if (sortField !== field) {
    return (
      <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return sortDirection === 'asc' ? (
    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
};

// Helper functions moved outside
const getRoleColor = (role: string) => {
  const colors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    AGENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    USER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  };
  return colors[role] || colors.USER;
};

const getUserName = (user: User) => {
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return '-';
};

// UserTable component moved outside to prevent re-creation on state change
interface UserTableProps {
  users: User[];
  title: string;
  count: number;
  displayLimit: number;
  setDisplayLimit: (limit: number) => void;
  totalCount: number;
  badgeColor: string;
  sortField: SortField;
  sortDirection: SortDirection;
  handleSort: (field: SortField) => void;
  editingUserId: string | null;
  editingEmail: string;
  editingFirstName: string;
  editingLastName: string;
  selectedRole: UserRole;
  setEditingEmail: (email: string) => void;
  setEditingFirstName: (firstName: string) => void;
  setEditingLastName: (lastName: string) => void;
  setSelectedRole: (role: UserRole) => void;
  handleEditUser: (user: User) => void;
  handleSaveUser: (userId: string) => void;
  handleCancelEdit: () => void;
  handleBlockUser: (user: User) => void;
  handleDeleteUser: (user: User) => void;
  isPending: boolean;
  isBlocking: boolean;
  isDeleting: boolean;
}

const UserTable: React.FC<UserTableProps> = ({
  users: displayUsers,
  title,
  count,
  displayLimit,
  setDisplayLimit,
  totalCount,
  badgeColor,
  sortField,
  sortDirection,
  handleSort,
  editingUserId,
  editingEmail,
  editingFirstName,
  editingLastName,
  selectedRole,
  setEditingEmail,
  setEditingFirstName,
  setEditingLastName,
  setSelectedRole,
  handleEditUser,
  handleSaveUser,
  handleCancelEdit,
  handleBlockUser,
  handleDeleteUser,
  isPending,
  isBlocking,
  isDeleting
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <span className={`px-3 py-1 ${badgeColor} text-sm font-semibold rounded-full`}>
        {count}
      </span>
    </div>
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[12%]" />
          <col className="w-[7%]" />
          <col className="w-[6%]" />
          <col className="w-[9%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th
              onClick={() => handleSort('email')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Email
                <SortIcon field="email" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('name')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Name
                <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('role')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Role
                <SortIcon field="role" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('tickets')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Tickets
                <SortIcon field="tickets" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('timezone')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Timezone
                <SortIcon field="timezone" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('country')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Country
                <SortIcon field="country" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('createdAt')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Joined
                <SortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('lastSeenAt')}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Last Seen
                <SortIcon field="lastSeenAt" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {displayUsers.map((user) => (
            <tr
              key={user.id}
              className={`transition-colors ${
                user.isBlocked
                  ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white max-w-0" title={user.email}>
                {editingUserId === user.id ? (
                  <input
                    type="email"
                    value={editingEmail}
                    onChange={(e) => setEditingEmail(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{user.email}</span>
                    {user.isBlocked && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded" title={user.blockedReason || 'Blocked'}>
                        BLOCKED
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white max-w-0" title={getUserName(user)}>
                {editingUserId === user.id ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editingFirstName}
                      onChange={(e) => setEditingFirstName(e.target.value)}
                      placeholder="First"
                      className="w-1/2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={editingLastName}
                      onChange={(e) => setEditingLastName(e.target.value)}
                      placeholder="Last"
                      className="w-1/2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <span className="block truncate">{getUserName(user)}</span>
                )}
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                {editingUserId === user.id ? (
                  <CustomSelect
                    value={selectedRole}
                    onChange={(v) => setSelectedRole(v as UserRole)}
                    options={[
                      { value: 'USER', label: 'User' },
                      { value: 'AGENT', label: 'Agent' },
                      { value: 'ADMIN', label: 'Admin' },
                    ]}
                    size="sm"
                  />
                ) : (
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {user._count?.ticketsCreated || 0}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {getTimezoneDisplay(user.timezoneOffset, user.country)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {getCountryDisplay(user.country, user.timezoneOffset)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(user.createdAt), 'MMM d, yyyy')}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {user.lastSeenAt ? format(new Date(user.lastSeenAt), 'MMM d, yyyy') : '-'}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm">
                {editingUserId === user.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveUser(user.id)}
                      disabled={isPending}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-primary hover:text-primary/80 p-1"
                      title="Edit user"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleBlockUser(user)}
                        disabled={isBlocking}
                        className={`p-1 ${user.isBlocked
                          ? 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300'
                          : 'text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300'
                        } disabled:opacity-50`}
                        title={user.isBlocked ? 'Unblock user' : 'Block user (mark as spam)'}
                      >
                        {user.isBlocked ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={isDeleting}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 disabled:opacity-50"
                      title="Delete user"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {totalCount > 10 && (
      <div className="flex justify-center gap-2">
        {displayLimit > 10 && (
          <button
            onClick={() => setDisplayLimit(10)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Show Less
          </button>
        )}
        {displayLimit < totalCount && (
          <button
            onClick={() => setDisplayLimit(Math.min(displayLimit + 100, totalCount))}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Show {Math.min(100, totalCount - displayLimit)} More ({totalCount - displayLimit} remaining)
          </button>
        )}
      </div>
    )}
  </div>
);

const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<SortField>('role');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [adminLimit, setAdminLimit] = useState(10);
  const [agentLimit, setAgentLimit] = useState(10);
  const [userLimit, setUserLimit] = useState(10);
  const [blockedLimit, setBlockedLimit] = useState(10);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState('');
  const [editingFirstName, setEditingFirstName] = useState('');
  const [editingLastName, setEditingLastName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('USER');
  const [searchQuery, setSearchQuery] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const response = await userApi.getAll();
      return response.data as User[];
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { email?: string; firstName?: string; lastName?: string; role?: UserRole } }) =>
      userApi.update(id, data),
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setEditingUserId(null);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to update user';
      toast.error(message);
    }
  });

  const blockUserMutation = useMutation({
    mutationFn: ({ id, isBlocked, reason }: { id: string; isBlocked: boolean; reason?: string }) =>
      userApi.block(id, isBlocked, reason),
    onSuccess: (_data, variables) => {
      toast.success(variables.isBlocked ? 'User blocked successfully' : 'User unblocked successfully');
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error: any) => {
      console.error('Block user error:', error?.response?.status, error?.response?.data);
      const message = error?.response?.data?.error || 'Failed to update user status';
      toast.error(message);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      toast.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setUserToDelete(null);
    },
    onError: (error: any) => {
      console.error('Delete user error:', error?.response?.status, error?.response?.data);
      const message = error?.response?.data?.error || 'Failed to delete user';
      toast.error(message);
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedUsers = useMemo(() => {
    if (!users) return [];

    return [...users].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'name':
          aValue = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
          bValue = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
          break;
        case 'role':
          const roleOrder = { ADMIN: 0, AGENT: 1, USER: 2 };
          aValue = roleOrder[a.role];
          bValue = roleOrder[b.role];
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'lastSeenAt':
          aValue = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          bValue = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          break;
        case 'timezone':
          aValue = a.timezoneOffset || '';
          bValue = b.timezoneOffset || '';
          break;
        case 'country':
          aValue = (a.country || '').toLowerCase();
          bValue = (b.country || '').toLowerCase();
          break;
        case 'tickets':
          aValue = a._count?.ticketsCreated || 0;
          bValue = b._count?.ticketsCreated || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortDirection]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return sortedUsers;

    const query = searchQuery.toLowerCase().trim();
    return sortedUsers.filter((user) => {
      const email = user.email.toLowerCase();
      const firstName = (user.firstName || '').toLowerCase();
      const lastName = (user.lastName || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();

      return (
        email.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query) ||
        fullName.includes(query)
      );
    });
  }, [sortedUsers, searchQuery]);

  const adminUsers = useMemo(() => {
    return filteredUsers.filter((user) => user.role === 'ADMIN' && !user.isBlocked);
  }, [filteredUsers]);

  const agentUsers = useMemo(() => {
    return filteredUsers.filter((user) => user.role === 'AGENT' && !user.isBlocked);
  }, [filteredUsers]);

  const regularUsers = useMemo(() => {
    return filteredUsers.filter((user) => user.role === 'USER' && !user.isBlocked);
  }, [filteredUsers]);

  const blockedUsers = useMemo(() => {
    return filteredUsers.filter((user) => user.isBlocked);
  }, [filteredUsers]);

  // Display arrays (limited by current limit)
  const displayAdminUsers = useMemo(() => {
    return adminUsers.slice(0, adminLimit);
  }, [adminUsers, adminLimit]);

  const displayAgentUsers = useMemo(() => {
    return agentUsers.slice(0, agentLimit);
  }, [agentUsers, agentLimit]);

  const displayRegularUsers = useMemo(() => {
    return regularUsers.slice(0, userLimit);
  }, [regularUsers, userLimit]);

  const displayBlockedUsers = useMemo(() => {
    return blockedUsers.slice(0, blockedLimit);
  }, [blockedUsers, blockedLimit]);

  const handleEditUser = useCallback((user: User) => {
    setEditingUserId(user.id);
    setEditingEmail(user.email);
    setEditingFirstName(user.firstName || '');
    setEditingLastName(user.lastName || '');
    setSelectedRole(user.role);
  }, []);

  const handleSaveUser = useCallback((userId: string) => {
    updateUserMutation.mutate({
      id: userId,
      data: {
        email: editingEmail,
        firstName: editingFirstName,
        lastName: editingLastName,
        role: selectedRole
      }
    });
  }, [editingEmail, editingFirstName, editingLastName, selectedRole, updateUserMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingUserId(null);
  }, []);

  const handleBlockUser = useCallback((user: User) => {
    blockUserMutation.mutate({
      id: user.id,
      isBlocked: !user.isBlocked,
      reason: user.isBlocked ? undefined : 'Marked as spam by admin'
    });
  }, [blockUserMutation]);

  const handleDeleteUser = useCallback((user: User) => {
    setUserToDelete(user);
  }, []);

  const confirmDelete = useCallback(() => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  }, [userToDelete, deleteUserMutation]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage user roles and permissions
            </p>
          </div>
          {/* Search Input */}
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="block w-full sm:w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading users...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">Failed to load users. Please try again.</p>
          </div>
        )}

        {/* Users list */}
        {sortedUsers && sortedUsers.length === 0 && !isLoading && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No users have been created yet.
            </p>
          </div>
        )}

        {/* No search results */}
        {sortedUsers && sortedUsers.length > 0 && filteredUsers.length === 0 && !isLoading && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No users match "{searchQuery}".
            </p>
          </div>
        )}

        {sortedUsers && sortedUsers.length > 0 && filteredUsers.length > 0 && (
          <>
            {/* Admin Users Section */}
            {adminUsers.length > 0 && (
              <UserTable
                users={displayAdminUsers}
                title="Administrators"
                count={adminUsers.length}
                displayLimit={adminLimit}
                setDisplayLimit={setAdminLimit}
                totalCount={adminUsers.length}
                badgeColor="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                editingUserId={editingUserId}
                editingEmail={editingEmail}
                editingFirstName={editingFirstName}
                editingLastName={editingLastName}
                selectedRole={selectedRole}
                setEditingEmail={setEditingEmail}
                setEditingFirstName={setEditingFirstName}
                setEditingLastName={setEditingLastName}
                setSelectedRole={setSelectedRole}
                handleEditUser={handleEditUser}
                handleSaveUser={handleSaveUser}
                handleCancelEdit={handleCancelEdit}
                handleBlockUser={handleBlockUser}
                handleDeleteUser={handleDeleteUser}
                isPending={updateUserMutation.isPending}
                isBlocking={blockUserMutation.isPending}
                isDeleting={deleteUserMutation.isPending}
              />
            )}

            {/* Agent Users Section */}
            {agentUsers.length > 0 && (
              <UserTable
                users={displayAgentUsers}
                title="Agents"
                count={agentUsers.length}
                displayLimit={agentLimit}
                setDisplayLimit={setAgentLimit}
                totalCount={agentUsers.length}
                badgeColor="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                editingUserId={editingUserId}
                editingEmail={editingEmail}
                editingFirstName={editingFirstName}
                editingLastName={editingLastName}
                selectedRole={selectedRole}
                setEditingEmail={setEditingEmail}
                setEditingFirstName={setEditingFirstName}
                setEditingLastName={setEditingLastName}
                setSelectedRole={setSelectedRole}
                handleEditUser={handleEditUser}
                handleSaveUser={handleSaveUser}
                handleCancelEdit={handleCancelEdit}
                handleBlockUser={handleBlockUser}
                handleDeleteUser={handleDeleteUser}
                isPending={updateUserMutation.isPending}
                isBlocking={blockUserMutation.isPending}
                isDeleting={deleteUserMutation.isPending}
              />
            )}

            {/* Regular Users Section */}
            {regularUsers.length > 0 && (
              <UserTable
                users={displayRegularUsers}
                title="Users"
                count={regularUsers.length}
                displayLimit={userLimit}
                setDisplayLimit={setUserLimit}
                totalCount={regularUsers.length}
                badgeColor="bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300"
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                editingUserId={editingUserId}
                editingEmail={editingEmail}
                editingFirstName={editingFirstName}
                editingLastName={editingLastName}
                selectedRole={selectedRole}
                setEditingEmail={setEditingEmail}
                setEditingFirstName={setEditingFirstName}
                setEditingLastName={setEditingLastName}
                setSelectedRole={setSelectedRole}
                handleEditUser={handleEditUser}
                handleSaveUser={handleSaveUser}
                handleCancelEdit={handleCancelEdit}
                handleBlockUser={handleBlockUser}
                handleDeleteUser={handleDeleteUser}
                isPending={updateUserMutation.isPending}
                isBlocking={blockUserMutation.isPending}
                isDeleting={deleteUserMutation.isPending}
              />
            )}

            {/* Blocked Users Section */}
            {blockedUsers.length > 0 && (
              <UserTable
                users={displayBlockedUsers}
                title="Blocked Users"
                count={blockedUsers.length}
                displayLimit={blockedLimit}
                setDisplayLimit={setBlockedLimit}
                totalCount={blockedUsers.length}
                badgeColor="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                editingUserId={editingUserId}
                editingEmail={editingEmail}
                editingFirstName={editingFirstName}
                editingLastName={editingLastName}
                selectedRole={selectedRole}
                setEditingEmail={setEditingEmail}
                setEditingFirstName={setEditingFirstName}
                setEditingLastName={setEditingLastName}
                setSelectedRole={setSelectedRole}
                handleEditUser={handleEditUser}
                handleSaveUser={handleSaveUser}
                handleCancelEdit={handleCancelEdit}
                handleBlockUser={handleBlockUser}
                handleDeleteUser={handleDeleteUser}
                isPending={updateUserMutation.isPending}
                isBlocking={blockUserMutation.isPending}
                isDeleting={deleteUserMutation.isPending}
              />
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        {userToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete User
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Are you sure you want to delete this user?
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 mb-4">
                <p className="font-medium text-gray-900 dark:text-white">
                  {userToDelete.firstName || userToDelete.lastName
                    ? `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim()
                    : userToDelete.email}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{userToDelete.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Role: <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getRoleColor(userToDelete.role)}`}>{userToDelete.role}</span>
                </p>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                This action cannot be undone. The user will be removed from both the database and Clerk.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                >
                  {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminUsers;
