import { useMemo, useState } from 'react';
import { Badge, Button, Dropdown, Empty, List, Space, Typography, theme } from 'antd';
import { DqpmTag } from './DqpmTag';
import { BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  useNotificationStore,
  type INotification,
  type TNotificationLevel,
} from '../stores/useNotificationStore';
import {
  fnSyncNotificationRead,
  fnSyncNotificationsReadAll,
} from '../services/notificationSync';
import {
  fnCollapseEventProgressNotifications,
  fnCountUnreadCollapsedNotifications,
} from '../utils/notificationView';

const { Text, Title } = Typography;

const OBJ_LEVEL_TAG: Record<TNotificationLevel, { strLabel: string; strColor: string }> = {
  success: { strLabel: '성공', strColor: 'success' },
  error: { strLabel: '오류', strColor: 'error' },
  warning: { strLabel: '경고', strColor: 'warning' },
  info: { strLabel: '정보', strColor: 'processing' },
};

const fnFormatAt = (strIso: string) => {
  const dt = dayjs(strIso);
  if (!dt.isValid()) return '';
  if (dayjs().diff(dt, 'day') < 1) return dt.format('HH:mm');
  return dt.format('MM-DD HH:mm');
};

const NotificationBellDropdown = () => {
  const { token } = theme.useToken();
  const [bDropdownOpen, setBDropdownOpen] = useState(false);
  const [strHoverItemId, setStrHoverItemId] = useState<string | null>(null);
  const [strSelectedItemId, setStrSelectedItemId] = useState<string | null>(null);
  const navigate = useNavigate();
  const arrNotifications = useNotificationStore((s) => s.arrNotifications);
  const fnMarkRead = useNotificationStore((s) => s.fnMarkRead);
  const fnMarkAllRead = useNotificationStore((s) => s.fnMarkAllRead);

  const arrVisibleNotifications = useMemo(
    () => fnCollapseEventProgressNotifications(arrNotifications),
    [arrNotifications],
  );

  const nUnreadCount = useMemo(
    () => fnCountUnreadCollapsedNotifications(arrNotifications),
    [arrNotifications],
  );

  const fnHandleItemClick = (objItem: INotification) => {
    setStrSelectedItemId(objItem.strId);
    fnMarkRead(objItem.strId);
    void fnSyncNotificationRead(objItem.strId);
    if (!objItem.strRoute) return;
    const objSearch = new URLSearchParams();
    if (objItem.objQuery) {
      for (const [strKey, value] of Object.entries(objItem.objQuery)) {
        objSearch.set(strKey, String(value));
      }
    }
    const strSearch = objSearch.toString();
    navigate(strSearch ? `${objItem.strRoute}?${strSearch}` : objItem.strRoute);
  };

  const fnHandleDropdownOpenChange = (bOpen: boolean) => {
    setBDropdownOpen(bOpen);
    if (!bOpen) {
      setStrSelectedItemId(null);
      setStrHoverItemId(null);
    }
  };

  const nodeDropdown = (
    <div
      style={{
        width: 360,
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorSplit}`,
          backgroundColor: token.colorBgContainer,
        }}
      >
        <Title level={5} style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>
          알림
        </Title>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 0' }}>
      {arrVisibleNotifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="알림이 없습니다"
          style={{ margin: '24px 0' }}
        />
      ) : (
        <List
          size="small"
          dataSource={arrVisibleNotifications}
          renderItem={(objItem) => {
            const objLevel = OBJ_LEVEL_TAG[objItem.strLevel];
            const bSelected = strSelectedItemId === objItem.strId;
            const bHover = strHoverItemId === objItem.strId;
            const strRowBg = bSelected
              ? token.colorPrimaryBg
              : bHover
                ? token.controlItemBgHover
                : !objItem.bRead
                  ? token.colorFillAlter
                  : undefined;
            return (
              <List.Item
                tabIndex={0}
                title={objItem.bRead ? undefined : '미읽음'}
                style={{
                  cursor: objItem.strRoute ? 'pointer' : 'default',
                  paddingInline: 12,
                  paddingBlock: 6,
                  borderRadius: token.borderRadius,
                  alignItems: 'flex-start',
                  transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                  backgroundColor: strRowBg,
                  boxShadow: bSelected ? `inset 3px 0 0 ${token.colorPrimary}` : undefined,
                }}
                onMouseEnter={() => setStrHoverItemId(objItem.strId)}
                onMouseLeave={() => setStrHoverItemId((prev) => (prev === objItem.strId ? null : prev))}
                onFocus={() => setStrHoverItemId(objItem.strId)}
                onBlur={() => setStrHoverItemId((prev) => (prev === objItem.strId ? null : prev))}
                onClick={() => fnHandleItemClick(objItem)}
              >
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    gap: 8,
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      flexShrink: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      paddingTop: 5,
                    }}
                    aria-hidden
                  >
                    {!objItem.bRead ? (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: token.colorPrimary,
                          boxShadow: bSelected
                            ? `0 0 0 1px ${token.colorBgElevated}`
                            : undefined,
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <List.Item.Meta
                      title={(
                        <Space size={6} wrap>
                          <DqpmTag color={objLevel.strColor}>{objLevel.strLabel}</DqpmTag>
                          <Text strong={!objItem.bRead}>{objItem.strTitle}</Text>
                        </Space>
                      )}
                      description={(
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          {objItem.strBody ? <Text type="secondary">{objItem.strBody}</Text> : null}
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {fnFormatAt(objItem.dtAt)}
                          </Text>
                        </Space>
                      )}
                    />
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
      </div>
      {arrVisibleNotifications.length > 0 ? (
        <div
          style={{
            padding: '8px 16px 10px',
            textAlign: 'right',
            borderTop: `1px solid ${token.colorSplit}`,
            backgroundColor: token.colorBgContainer,
          }}
        >
          <Button type="link" size="small" onClick={() => {
            fnMarkAllRead();
            void fnSyncNotificationsReadAll();
          }}>
            모두 읽음
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <Dropdown
      open={bDropdownOpen}
      onOpenChange={fnHandleDropdownOpenChange}
      dropdownRender={() => nodeDropdown}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={nUnreadCount} size="small" offset={[-2, 2]}>
        <Button
          type={bDropdownOpen ? 'primary' : 'text'}
          icon={<BellOutlined />}
          title="알림"
          style={{ fontSize: 16 }}
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBellDropdown;
