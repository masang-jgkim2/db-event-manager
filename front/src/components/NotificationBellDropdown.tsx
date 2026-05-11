import { useMemo } from 'react';
import { Badge, Button, Dropdown, Empty, List, Space, Tag, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  useNotificationStore,
  type INotification,
  type TNotificationLevel,
} from '../stores/useNotificationStore';

const { Text } = Typography;

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
  const navigate = useNavigate();
  const arrNotifications = useNotificationStore((s) => s.arrNotifications);
  const fnMarkRead = useNotificationStore((s) => s.fnMarkRead);
  const fnMarkAllRead = useNotificationStore((s) => s.fnMarkAllRead);

  const nUnreadCount = useMemo(
    () => arrNotifications.filter((objItem) => !objItem.bRead).length,
    [arrNotifications],
  );

  const fnHandleItemClick = (objItem: INotification) => {
    fnMarkRead(objItem.strId);
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

  const nodeDropdown = (
    <div style={{ width: 360, maxHeight: 420, overflow: 'auto', padding: '8px 0' }}>
      {arrNotifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="알림이 없습니다"
          style={{ margin: '24px 0' }}
        />
      ) : (
        <List
          size="small"
          dataSource={arrNotifications}
          renderItem={(objItem) => {
            const objLevel = OBJ_LEVEL_TAG[objItem.strLevel];
            return (
              <List.Item
                style={{
                  cursor: objItem.strRoute ? 'pointer' : 'default',
                  opacity: objItem.bRead ? 0.72 : 1,
                  paddingInline: 16,
                }}
                onClick={() => fnHandleItemClick(objItem)}
              >
                <List.Item.Meta
                  title={(
                    <Space size={6} wrap>
                      <Tag color={objLevel.strColor}>{objLevel.strLabel}</Tag>
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
              </List.Item>
            );
          }}
        />
      )}
      {arrNotifications.length > 0 ? (
        <div style={{ padding: '8px 16px 0', textAlign: 'right' }}>
          <Button type="link" size="small" onClick={() => fnMarkAllRead()}>
            모두 읽음
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <Dropdown dropdownRender={() => nodeDropdown} trigger={['click']} placement="bottomRight">
      <Badge count={nUnreadCount} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<BellOutlined />} title="알림" style={{ fontSize: 16 }} />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBellDropdown;
