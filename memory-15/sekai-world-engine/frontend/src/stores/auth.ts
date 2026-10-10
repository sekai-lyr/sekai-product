import { computed, ref } from 'vue'
import type { User } from '../types'

const user = ref<User | null>(null)
const token = ref(localStorage.getItem('sekai.token'))

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(token.value))
  function setSession(nextToken: string, nextUser: User) {
    token.value = nextToken
    user.value = nextUser
    localStorage.setItem('sekai.token', nextToken)
    localStorage.setItem('sekai.user', JSON.stringify(nextUser))
  }
  function restore() {
    const stored = localStorage.getItem('sekai.user')
    if (stored) user.value = JSON.parse(stored) as User
  }
  function signOut() {
    token.value = null
    user.value = null
    localStorage.removeItem('sekai.token')
    localStorage.removeItem('sekai.user')
  }
  restore()
  return { user, isAuthenticated, setSession, signOut }
}
