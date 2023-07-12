// Defines our options interface.
export interface SocketOptions {
  cipher ?: string
  echo    : boolean
  kind    : number
  tags    : string[][]
}

// For using partial config objects.
export type SocketConfig = Partial<SocketOptions>

// Defines our default options.
export const DEFAULTS : SocketOptions = {
  echo : false,
  kind : 20000,
  tags : []
}

export function get_config (
  config : SocketConfig = {}
) : SocketOptions {
  /* Applies our default options, plus custom configs.
   */
  return { ...DEFAULTS, ...config  }
}
