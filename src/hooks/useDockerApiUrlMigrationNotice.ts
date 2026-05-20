import { useEffect } from 'react'
import { useStore } from '../store'
import { readRuntimeEnv } from '../lib/runtimeEnv'

const NOTICE_KEY = 'docker-api-url-migration-notice-v1'

export function useDockerApiUrlMigrationNotice() {
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)

  useEffect(() => {
    if (readRuntimeEnv(import.meta.env.VITE_DOCKER_DEPLOYMENT) !== 'true') return
    if (readRuntimeEnv(import.meta.env.VITE_DOCKER_LEGACY_API_URL_USED) !== 'true') return
    if (localStorage.getItem(NOTICE_KEY) === 'true') return

    const dismiss = () => {
      localStorage.setItem(NOTICE_KEY, 'true')
    }

    setConfirmDialog({
      title: 'Docker 部署配置变更',
      message: '当前版本已将 Docker 环境变量 `API_URL` 改名为 `DEFAULT_API_URL`。\n\n`DEFAULT_API_URL` 用于前端设置中的默认 API 地址。\n\n为避免升级后立即失效，旧的 `API_URL` 仍会作为兜底值。建议后续更新 docker run 或 docker-compose 配置，显式使用 `DEFAULT_API_URL`。',
      confirmText: '我知道了',
      showCancel: false,
      icon: 'info',
      minConfirmDelayMs: 3000,
      action: dismiss,
      cancelAction: dismiss,
    })
  }, [setConfirmDialog])
}
