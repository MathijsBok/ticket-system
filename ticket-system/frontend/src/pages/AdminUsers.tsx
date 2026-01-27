import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../lib/api';
import { User, UserRole } from '../types';
import Layout from '../components/Layout';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type SortField = 'email' | 'name' | 'role' | 'createdAt' | 'tickets';
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
    AGENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    USER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
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
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
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
  isPending: boolean;
}

const UserTable: React.FC<UserTableProps> = ({
  users: displayUsers,
  title,
  count,
  expanded,
  setExpanded,
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
  isPending
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
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th
              onClick={() => handleSort('email')}
              className="w-[37.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Email
                <SortIcon field="email" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('name')}
              className="w-[12.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Name
                <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('role')}
              className="w-[12.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Role
                <SortIcon field="role" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('tickets')}
              className="w-[12.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Tickets
                <SortIcon field="tickets" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th
              onClick={() => handleSort('createdAt')}
              className="w-[12.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                Joined
                <SortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
              </div>
            </th>
            <th className="w-[12.5%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {displayUsers.map((user) => (
            <tr
              key={user.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">
                {editingUserId === user.id ? (
                  <input
                    type="email"
                    value={editingEmail}
                    onChange={(e) => setEditingEmail(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  user.email
                )}
              </td>
              <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">
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
                  getUserName(user)
                )}
              </td>
              <td className="px-6 py-2 whitespace-nowrap">
                {editingUserId === user.id ? (
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="USER">User</option>
                    <option value="AGENT">Agent</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                ) : (
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                )}
              </td>
              <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {user._count?.ticketsCreated || 0}
              </td>
              <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(user.createdAt), 'MMM d, yyyy')}
              </td>
              <td className="px-6 py-2 whitespace-nowrap text-sm">
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
                  <button
                    onClick={() => handleEditUser(user)}
                    className="text-primary hover:text-primary/80"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {totalCount > 10 && (
      <div className="flex justify-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
        >
          {expanded ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Show Less
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Show {totalCount - 10} More
            </>
          )}
        </button>
      </div>
    )}
  </div>
);

const AdminUsers: React.FC = () => {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<SortField>('role');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  const [userExpanded, setUserExpanded] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState('');
  const [editingFirstName, setEditingFirstName] = useState('');
  const [editingLastName, setEditingLastName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('USER');

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

  const adminUsers = useMemo(() => {
    return sortedUsers.filter((user) => user.role === 'ADMIN');
  }, [sortedUsers]);

  const agentUsers = useMemo(() => {
    return sortedUsers.filter((user) => user.role === 'AGENT');
  }, [sortedUsers]);

  const regularUsers = useMemo(() => {
    return sortedUsers.filter((user) => user.role === 'USER');
  }, [sortedUsers]);

  // Display arrays (limited to 10 unless expanded)
  const displayAdminUsers = useMemo(() => {
    return adminExpanded ? adminUsers : adminUsers.slice(0, 10);
  }, [adminUsers, adminExpanded]);

  const displayAgentUsers = useMemo(() => {
    return agentExpanded ? agentUsers : agentUsers.slice(0, 10);
  }, [agentUsers, agentExpanded]);

  const displayRegularUsers = useMemo(() => {
    return userExpanded ? regularUsers : regularUsers.slice(0, 10);
  }, [regularUsers, userExpanded]);

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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage user roles and permissions
            </p>
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

        {sortedUsers && sortedUsers.length > 0 && (
          <>
            {/* Admin Users Section */}
            {adminUsers.length > 0 && (
              <UserTable
                users={displayAdminUsers}
                title="Administrators"
                count={adminUsers.length}
                expanded={adminExpanded}
                setExpanded={setAdminExpanded}
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
                isPending={updateUserMutation.isPending}
              />
            )}

            {/* Agent Users Section */}
            {agentUsers.length > 0 && (
              <UserTable
                users={displayAgentUsers}
                title="Agents"
                count={agentUsers.length}
                expanded={agentExpanded}
                setExpanded={setAgentExpanded}
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
                isPending={updateUserMutation.isPending}
              />
            )}

            {/* Regular Users Section */}
            {regularUsers.length > 0 && (
              <UserTable
                users={displayRegularUsers}
                title="Users"
                count={regularUsers.length}
                expanded={userExpanded}
                setExpanded={setUserExpanded}
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
                isPending={updateUserMutation.isPending}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminUsers;
