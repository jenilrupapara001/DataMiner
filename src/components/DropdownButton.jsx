import { ChevronDown, Container, HelpCircle, LayersTwo01, LogOut01, Settings01, User01 } from "@untitledui/icons";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const DropdownButton = () => {
    const navigate = useNavigate();
    const { user, logout, hasPermission } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <Dropdown.Root>
            <Dropdown.Trigger className="group d-flex align-items-center gap-3 border-0 bg-transparent p-0">
                <div className="position-relative">
                    <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: '36px', height: '36px', fontSize: '0.85rem', fontWeight: '600' }}>
                        {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'A'}
                    </div>
                    <span
                        className="position-absolute bottom-0 end-0 bg-success border border-white rounded-circle"
                        style={{ width: '10px', height: '10px', borderWidth: '1.5px' }}
                    ></span>
                </div>
                <div className="d-none d-lg-flex flex-column align-items-start me-1">
                    <span className="small fw-semibold text-dark mb-0" style={{ lineHeight: '1.2' }}>{user?.firstName || 'User'}</span>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>{user?.role?.displayName || user?.role?.name || 'Standard User'}</span>
                </div>
                <ChevronDown size={14} className="text-muted transition-transform group-hover-rotate-180" />
            </Dropdown.Trigger>

            <Dropdown.Popover>
                <div style={{ width: '280px', borderRadius: '12px', overflow: 'hidden' }}>
                    <div className="p-3 border-bottom bg-light bg-opacity-20" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                        <AvatarLabelGroup
                            size="md"
                            src={user?.avatar || "https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80"}
                            status="online"
                            title={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email}
                            subtitle={user?.email}
                        />
                    </div>
                    <div className="p-1">
                        <Dropdown.Menu>
                            <Dropdown.Section>
                                <Dropdown.Item addon="⌘K->P" icon={User01} onClick={() => navigate('/profile')}>
                                    View profile
                                </Dropdown.Item>
                                {hasPermission('dashboard_view') && (
                                    <Dropdown.Item addon="⌘S" icon={Settings01} onClick={() => navigate('/settings')}>
                                        Settings
                                    </Dropdown.Item>
                                )}
                            </Dropdown.Section>
                            {(hasPermission('users_view') || hasPermission('roles_view')) && <Dropdown.Separator />}
                            {(hasPermission('users_view') || hasPermission('roles_view')) && (
                                <Dropdown.Section>
                                    {hasPermission('users_view') && (
                                        <Dropdown.Item icon={User01} onClick={() => navigate('/users')}>
                                            User Management
                                        </Dropdown.Item>
                                    )}
                                    {hasPermission('roles_view') && (
                                        <Dropdown.Item icon={LayersTwo01} onClick={() => navigate('/roles')}>
                                            Role Management
                                        </Dropdown.Item>
                                    )}
                                </Dropdown.Section>
                            )}
                            <Dropdown.Separator />
                            <Dropdown.Section>
                                <Dropdown.Item icon={HelpCircle} onClick={() => navigate('/support')}>Support</Dropdown.Item>
                            </Dropdown.Section>
                            <Dropdown.Separator />
                            <Dropdown.Section>
                                <Dropdown.Item
                                    addon="⌥⇧Q"
                                    icon={LogOut01}
                                    onClick={handleLogout}
                                >
                                    <span className="text-danger fw-semibold">Log out</span>
                                </Dropdown.Item>
                            </Dropdown.Section>
                        </Dropdown.Menu>
                    </div>
                </div>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
};
