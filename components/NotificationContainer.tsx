"use client";

import { useUI } from "@/lib/state/providers/UIProvider";
import styles from "./NotificationContainer.module.css";

export default function NotificationContainer() {
  const { state, removeNotification } = useUI();

  if (state.notifications.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {state.notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${styles.notification} ${styles[`notification--${notification.type}`]}`}
          role="alert"
          aria-live="polite"
        >
          <div className={styles.content}>
            <div className={styles.header}>
              <span className={styles.icon}>
                {notification.type === 'success' && '✓'}
                {notification.type === 'error' && '✕'}
                {notification.type === 'warning' && '⚠'}
                {notification.type === 'info' && 'ℹ'}
              </span>
              <h4 className={styles.title}>{notification.title}</h4>
            </div>
            {notification.message && (
              <p className={styles.message}>{notification.message}</p>
            )}
          </div>
          <button
            className={styles.closeButton}
            onClick={() => removeNotification(notification.id)}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

