'use client'
import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { Camera, RefreshCw, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void
  onCancel?: () => void
}

const videoConstraints: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' }, // câmera traseira em mobile
  width: { ideal: 1280 },
  height: { ideal: 720 },
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) setCaptured(imageSrc)
  }, [])

  const handleRetake = () => setCaptured(null)

  const handleConfirm = () => {
    if (captured) onCapture(captured)
  }

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-red-50 rounded-2xl border border-red-200">
        <Camera className="w-12 h-12 text-red-400" />
        <p className="text-sm text-red-700 text-center font-medium">
          Acesso à câmera negado. Permita o acesso nas configurações do navegador e recarregue a página.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        {captured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={captured} alt="Foto capturada" className="w-full h-full object-cover" />
        ) : (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.85}
              videoConstraints={videoConstraints}
              onUserMedia={() => setCameraReady(true)}
              onUserMediaError={() => setPermissionDenied(true)}
              className="w-full h-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
              </div>
            )}
            {/* Mira de enquadramento */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white/60 rounded-xl" />
            </div>
          </>
        )}
      </div>

      {captured ? (
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleRetake} className="flex-1">
            <RefreshCw className="w-4 h-4" /> Refazer
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            <CheckCircle className="w-4 h-4" /> Confirmar
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
          )}
          <Button onClick={handleCapture} disabled={!cameraReady} className="flex-1">
            <Camera className="w-5 h-5" /> Tirar Foto
          </Button>
        </div>
      )}
    </div>
  )
}
