"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface Farm {
  id: number
  name: string
  code: string
}

interface FarmContextType {
  farms: Farm[]
  selectedFarmId: number | null
  setSelectedFarmId: (id: number | null) => void
  loading: boolean
}

const FarmContext = createContext<FarmContextType>({
  farms: [],
  selectedFarmId: null,
  setSelectedFarmId: () => {},
  loading: true,
})

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const response = await fetch('/api/farms')
        const result = await response.json()
        if (result.success) {
          setFarms(result.data)
          // 如果有基地，默认选中第一个
          if (result.data.length > 0 && selectedFarmId === null) {
            const saved = localStorage.getItem('selectedFarmId')
            const savedId = saved ? parseInt(saved) : null
            if (savedId && result.data.some((f: Farm) => f.id === savedId)) {
              setSelectedFarmId(savedId)
            } else {
              setSelectedFarmId(result.data[0].id)
            }
          }
        }
      } catch (error) {
        console.error("获取基地列表失败:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchFarms()
  }, [])

  const handleSetSelectedFarmId = (id: number | null) => {
    setSelectedFarmId(id)
    if (id) {
      localStorage.setItem('selectedFarmId', id.toString())
    } else {
      localStorage.removeItem('selectedFarmId')
    }
  }

  return (
    <FarmContext.Provider value={{ farms, selectedFarmId, setSelectedFarmId: handleSetSelectedFarmId, loading }}>
      {children}
    </FarmContext.Provider>
  )
}

export function useFarm() {
  return useContext(FarmContext)
}
