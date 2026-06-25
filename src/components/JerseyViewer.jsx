import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'

function JerseyModel({ primaryColor, secondaryColor, pattern }) {
  const { scene } = useGLTF('/assets/soccer_jersey.glb')
  const modelRef = useRef()

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.color = new THREE.Color(primaryColor)
        child.material.needsUpdate = true
      }
    })
  }, [primaryColor, scene])

  useFrame((state) => {
    if (modelRef.current) {
      modelRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2
    }
  })

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={2.5}
      position={[0, -1, 0]}
    />
  )
}

export default function JerseyViewer({ primary='#dc2626', secondary='#ffffff', pattern='solid' }) {
  return (
    <div style={{ width:'100%', height:'100%', borderRadius:12, overflow:'hidden' }}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        style={{ background:'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        <spotLight position={[0, 10, 0]} intensity={0.8} />
        <JerseyModel primaryColor={primary} secondaryColor={secondary} pattern={pattern} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.5}
          autoRotate
          autoRotateSpeed={1}
        />
        <Environment preset="studio" />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/assets/soccer_jersey.glb')
