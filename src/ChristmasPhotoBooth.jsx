import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Download, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react';

const ChristmasPhotoBooth = () => {
  const [step, setStep] = useState('welcome'); // welcome, camera, review
  const [cameraActive, setCameraActive] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('user'); // 'user' or 'environment'
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [templateHovered, setTemplateHovered] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousTemplate, setPreviousTemplate] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const carouselRef = useRef(null);
  const templateRefs = useRef([]);

  // Christmas Templates as SVG Components
  const templates = [
    {
      id: 0,
      name: "Santa's Workshop",
      component: ({ width, height }) => {
        const patternId = `candyCane-${width}-${height}`;
        const gradientId = `goldGrad-${width}-${height}`;
        const shimmerId = `shimmer-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <pattern id={patternId} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="#DC2626"/>
                <rect x="0" y="0" width="20" height="40" fill="#FFFFFF"/>
              </pattern>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="1"/>
                <stop offset="50%" stopColor="#FCD34D" stopOpacity="1"/>
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="1">
                  <animate attributeName="stop-opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite"/>
                </stop>
              </linearGradient>
              <linearGradient id={shimmerId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" stopOpacity="0"/>
                <stop offset="50%" stopColor="white" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="transparent" stopOpacity="0">
                  <animate attributeName="x1" values="-100%;200%" dur="3s" repeatCount="indefinite"/>
                  <animate attributeName="x2" values="0%;300%" dur="3s" repeatCount="indefinite"/>
                </stop>
              </linearGradient>
              <filter id={`glow-${width}-${height}`}>
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Outer glow border */}
            <rect x="0" y="0" width={width} height="80" fill={`url(#${patternId})`} opacity="0.95" rx="5"/>
            <rect x="0" y={height - 80} width={width} height="80" fill={`url(#${patternId})`} opacity="0.95" rx="5"/>
            <rect x="0" y="0" width="80" height={height} fill={`url(#${patternId})`} opacity="0.95" rx="5"/>
            <rect x={width - 80} y="0" width="80" height={height} fill={`url(#${patternId})`} opacity="0.95" rx="5"/>
            
            {/* Shimmer overlay */}
            <rect x="0" y="0" width={width} height="80" fill={`url(#${shimmerId})`} opacity="0.5"/>
            <rect x="0" y={height - 80} width={width} height="80" fill={`url(#${shimmerId})`} opacity="0.5"/>
            <rect x="0" y="0" width="80" height={height} fill={`url(#${shimmerId})`} opacity="0.5"/>
            <rect x={width - 80} y="0" width="80" height={height} fill={`url(#${shimmerId})`} opacity="0.5"/>
            
            {/* Inner decorative border */}
            <rect x="10" y="10" width={width - 20} height="8" fill={`url(#${gradientId})`} rx="4" filter={`url(#glow-${width}-${height})`}/>
            <rect x="10" y={height - 18} width={width - 20} height="8" fill={`url(#${gradientId})`} rx="4" filter={`url(#glow-${width}-${height})`}/>
            <rect x="10" y="10" width="8" height={height - 20} fill={`url(#${gradientId})`} rx="4" filter={`url(#glow-${width}-${height})`}/>
            <rect x={width - 18} y="10" width="8" height={height - 20} fill={`url(#${gradientId})`} rx="4" filter={`url(#glow-${width}-${height})`}/>
            
            {/* Enhanced corner decorations with glow */}
            <circle cx="40" cy="40" r="18" fill={`url(#${gradientId})`} filter={`url(#glow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0s'}}/>
            <circle cx={width - 40} cy="40" r="18" fill={`url(#${gradientId})`} filter={`url(#glow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.5s'}}/>
            <circle cx="40" cy={height - 40} r="18" fill={`url(#${gradientId})`} filter={`url(#glow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '1s'}}/>
            <circle cx={width - 40} cy={height - 40} r="18" fill={`url(#${gradientId})`} filter={`url(#glow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '1.5s'}}/>
            
            {/* Inner star decorations */}
            <path d={`M${width / 2},25 L${width / 2 - 8},35 L${width / 2 + 8},35 Z`} fill="#FFFFFF" opacity="0.9" className="animate-float"/>
            <path d={`M${width / 2},${height - 25} L${width / 2 - 8},${height - 35} L${width / 2 + 8},${height - 35} Z`} fill="#FFFFFF" opacity="0.9" className="animate-float" style={{animationDelay: '1.5s'}}/>
            
            {/* Enhanced text with multiple shadows */}
            <text x={width / 2} y="50" textAnchor="middle" fill="#F59E0B" fontSize={Math.min(36, width / 22)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#glow-${width}-${height})`} className="animate-float">
              <tspan x={width / 2} y="50" fill="#FFFFFF" opacity="0.3" dx="-2" dy="2">Ho Ho Ho!</tspan>
              <tspan x={width / 2} y="50" fill="#F59E0B">Ho Ho Ho!</tspan>
            </text>
          </svg>
        );
      }
    },
    {
      id: 1,
      name: "Winter Wonderland",
      component: ({ width, height }) => {
        const patternId = `snowflake-${width}-${height}`;
        const gradientId = `snowGrad-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <pattern id={patternId} x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M15,0 L15,30 M0,15 L30,15 M7.5,7.5 L22.5,22.5 M22.5,7.5 L7.5,22.5" stroke="#E0F2FE" strokeWidth="1"/>
              </pattern>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.9"/>
                <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1"/>
                <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.9"/>
              </linearGradient>
              <filter id={`snowGlow-${width}-${height}`}>
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Frosted glass border with gradient */}
            <rect x="0" y="0" width={width} height="70" fill={`url(#${gradientId})`} opacity="0.95" rx="8" filter={`url(#snowGlow-${width}-${height})`}/>
            <rect x="0" y={height - 70} width={width} height="70" fill={`url(#${gradientId})`} opacity="0.95" rx="8" filter={`url(#snowGlow-${width}-${height})`}/>
            <rect x="0" y="0" width="70" height={height} fill={`url(#${gradientId})`} opacity="0.95" rx="8" filter={`url(#snowGlow-${width}-${height})`}/>
            <rect x={width - 70} y="0" width="70" height={height} fill={`url(#${gradientId})`} opacity="0.95" rx="8" filter={`url(#snowGlow-${width}-${height})`}/>
            
            {/* Animated snowflakes pattern */}
            <rect x="0" y="0" width={width} height={height} fill={`url(#${patternId})`} opacity="0.4" className="animate-shimmer"/>
            
            {/* Sparkling snowflake decorations */}
            {[...Array(8)].map((_, i) => {
              const angle = (i * Math.PI * 2) / 8;
              const radius = Math.min(width, height) * 0.15;
              const cx = width / 2 + Math.cos(angle) * radius;
              const cy = height / 2 + Math.sin(angle) * radius;
              return (
                <circle key={i} cx={cx} cy={cy} r="4" fill="#FFFFFF" opacity="0.8" filter={`url(#snowGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: `${i * 0.25}s`}}/>
              );
            })}
            
            {/* Enhanced text with glow */}
            <text x={width / 2} y="45" textAnchor="middle" fill="#0EA5E9" fontSize={Math.min(32, width / 25)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#snowGlow-${width}-${height})`} className="animate-float">
              <tspan x={width / 2} y="45" fill="#FFFFFF" opacity="0.4" dx="-1" dy="1">Let it Snow</tspan>
              <tspan x={width / 2} y="45" fill="#0EA5E9">Let it Snow</tspan>
            </text>
          </svg>
        );
      }
    },
    {
      id: 2,
      name: "Christmas Tree",
      component: ({ width, height }) => {
        const gradientId = `treeGrad-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#047857" stopOpacity="0.95"/>
                <stop offset="50%" stopColor="#059669" stopOpacity="1"/>
                <stop offset="100%" stopColor="#065F46" stopOpacity="0.95"/>
              </linearGradient>
              <filter id={`treeGlow-${width}-${height}`}>
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Rich green border with gradient */}
            <rect x="0" y="0" width={width} height="90" fill={`url(#${gradientId})`} rx="10" filter={`url(#treeGlow-${width}-${height})`}/>
            <rect x="0" y={height - 90} width={width} height="90" fill={`url(#${gradientId})`} rx="10" filter={`url(#treeGlow-${width}-${height})`}/>
            <rect x="0" y="0" width="90" height={height} fill={`url(#${gradientId})`} rx="10" filter={`url(#treeGlow-${width}-${height})`}/>
            <rect x={width - 90} y="0" width="90" height={height} fill={`url(#${gradientId})`} rx="10" filter={`url(#treeGlow-${width}-${height})`}/>
            
            {/* Garland decoration */}
            <path d={`M0,45 Q${width/4},35 ${width/2},45 T${width},45`} stroke="#F59E0B" strokeWidth="3" fill="none" opacity="0.8" className="animate-float"/>
            <path d={`M0,${height-45} Q${width/4},${height-35} ${width/2},${height-45} T${width},${height-45}`} stroke="#F59E0B" strokeWidth="3" fill="none" opacity="0.8" className="animate-float" style={{animationDelay: '1s'}}/>
            
            {/* Enhanced ornaments with glow */}
            <circle cx="45" cy="45" r="16" fill="#DC2626" filter={`url(#treeGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0s'}}/>
            <circle cx="45" cy="45" r="10" fill="#FFFFFF" opacity="0.6"/>
            <circle cx={width - 45} cy="45" r="16" fill="#F59E0B" filter={`url(#treeGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.3s'}}/>
            <circle cx={width - 45} cy="45" r="10" fill="#FFFFFF" opacity="0.6"/>
            <circle cx="45" cy={height - 45} r="16" fill="#DC2626" filter={`url(#treeGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.6s'}}/>
            <circle cx="45" cy={height - 45} r="10" fill="#FFFFFF" opacity="0.6"/>
            <circle cx={width - 45} cy={height - 45} r="16" fill="#F59E0B" filter={`url(#treeGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.9s'}}/>
            <circle cx={width - 45} cy={height - 45} r="10" fill="#FFFFFF" opacity="0.6"/>
            
            {/* Animated star topper */}
            <path d={`M${width / 2},25 L${width / 2 - 20},45 L${width / 2 + 20},45 Z`} fill="#F59E0B" filter={`url(#treeGlow-${width}-${height})`} className="animate-twinkle"/>
            <circle cx={width / 2} cy="35" r="5" fill="#FFFFFF" opacity="0.9"/>
            
            {/* Enhanced text */}
            <text x={width / 2} y="60" textAnchor="middle" fill="#FEF3C7" fontSize={Math.min(34, width / 24)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#treeGlow-${width}-${height})`} className="animate-float">
              <tspan x={width / 2} y="60" fill="#047857" opacity="0.3" dx="-2" dy="2">Merry Christmas</tspan>
              <tspan x={width / 2} y="60" fill="#FEF3C7">Merry Christmas</tspan>
            </text>
          </svg>
        );
      }
    },
    {
      id: 3,
      name: "Gingerbread House",
      component: ({ width, height }) => {
        const textureId = `cookie-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <pattern id={textureId} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill="#78350F" opacity="0.3"/>
                <circle cx="5" cy="5" r="0.5" fill="#92400E" opacity="0.2"/>
              </pattern>
              <filter id={`cookieGlow-${width}-${height}`}>
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Rich brown cookie frame with texture */}
            <rect x="0" y="0" width={width} height="100" fill="#92400E" opacity="0.95" rx="12"/>
            <rect x="0" y={height - 100} width={width} height="100" fill="#92400E" opacity="0.95" rx="12"/>
            <rect x="0" y="0" width="100" height={height} fill="#92400E" opacity="0.95" rx="12"/>
            <rect x={width - 100} y="0" width="100" height={height} fill="#92400E" opacity="0.95" rx="12"/>
            <rect x="0" y="0" width={width} height="100" fill={`url(#${textureId})`} opacity="0.5" rx="12"/>
            <rect x="0" y={height - 100} width={width} height="100" fill={`url(#${textureId})`} opacity="0.5" rx="12"/>
            <rect x="0" y="0" width="100" height={height} fill={`url(#${textureId})`} opacity="0.5" rx="12"/>
            <rect x={width - 100} y="0" width="100" height={height} fill={`url(#${textureId})`} opacity="0.5" rx="12"/>
            
            {/* Enhanced icing details with glow */}
            <rect x="15" y="15" width={width - 30} height="12" fill="#FFFFFF" rx="6" filter={`url(#cookieGlow-${width}-${height})`} opacity="0.95"/>
            <rect x="15" y={height - 27} width={width - 30} height="12" fill="#FFFFFF" rx="6" filter={`url(#cookieGlow-${width}-${height})`} opacity="0.95"/>
            <rect x="15" y="15" width="12" height={height - 30} fill="#FFFFFF" rx="6" filter={`url(#cookieGlow-${width}-${height})`} opacity="0.95"/>
            <rect x={width - 27} y="15" width="12" height={height - 30} fill="#FFFFFF" rx="6" filter={`url(#cookieGlow-${width}-${height})`} opacity="0.95"/>
            
            {/* Enhanced candy decorations */}
            <circle cx="50" cy="50" r="12" fill="#DC2626" filter={`url(#cookieGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0s'}}/>
            <circle cx="50" cy="50" r="6" fill="#FFFFFF" opacity="0.8"/>
            <circle cx={width - 50} cy="50" r="12" fill="#F59E0B" filter={`url(#cookieGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.3s'}}/>
            <circle cx={width - 50} cy="50" r="6" fill="#FFFFFF" opacity="0.8"/>
            <circle cx="50" cy={height - 50} r="12" fill="#DC2626" filter={`url(#cookieGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.6s'}}/>
            <circle cx="50" cy={height - 50} r="6" fill="#FFFFFF" opacity="0.8"/>
            <circle cx={width - 50} cy={height - 50} r="12" fill="#F59E0B" filter={`url(#cookieGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.9s'}}/>
            <circle cx={width - 50} cy={height - 50} r="6" fill="#FFFFFF" opacity="0.8"/>
            
            {/* Text */}
            <text x={width / 2} y="65" textAnchor="middle" fill="#FEF3C7" fontSize={Math.min(32, width / 26)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#cookieGlow-${width}-${height})`} className="animate-float">
              <tspan x={width / 2} y="65" fill="#92400E" opacity="0.4" dx="-2" dy="2">Sweet Holidays</tspan>
              <tspan x={width / 2} y="65" fill="#FEF3C7">Sweet Holidays</tspan>
            </text>
          </svg>
        );
      }
    },
    {
      id: 4,
      name: "Mistletoe & Holly",
      component: ({ width, height }) => {
        const gradientId = `hollyGrad-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#065F46" stopOpacity="0.95"/>
                <stop offset="50%" stopColor="#047857" stopOpacity="1"/>
                <stop offset="100%" stopColor="#064E3B" stopOpacity="0.95"/>
              </linearGradient>
              <filter id={`hollyGlow-${width}-${height}`}>
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Elegant green leaves border */}
            <rect x="0" y="0" width={width} height="80" fill={`url(#${gradientId})`} rx="10" filter={`url(#hollyGlow-${width}-${height})`}/>
            <rect x="0" y={height - 80} width={width} height="80" fill={`url(#${gradientId})`} rx="10" filter={`url(#hollyGlow-${width}-${height})`}/>
            <rect x="0" y="0" width="80" height={height} fill={`url(#${gradientId})`} rx="10" filter={`url(#hollyGlow-${width}-${height})`}/>
            <rect x={width - 80} y="0" width="80" height={height} fill={`url(#${gradientId})`} rx="10" filter={`url(#hollyGlow-${width}-${height})`}/>
            
            {/* Leaf decorations */}
            <ellipse cx="40" cy="40" rx="15" ry="25" fill="#047857" opacity="0.6" transform="rotate(-45 40 40)" className="animate-float"/>
            <ellipse cx={width - 40} cy="40" rx="15" ry="25" fill="#047857" opacity="0.6" transform="rotate(45)" className="animate-float" style={{animationDelay: '0.5s'}}/>
            <ellipse cx="40" cy={height - 40} rx="15" ry="25" fill="#047857" opacity="0.6" transform="rotate(45)" className="animate-float" style={{animationDelay: '1s'}}/>
            <ellipse cx={width - 40} cy={height - 40} rx="15" ry="25" fill="#047857" opacity="0.6" transform="rotate(-45)" className="animate-float" style={{animationDelay: '1.5s'}}/>
            
            {/* Enhanced holly berries with glow */}
            <circle cx="40" cy="40" r="14" fill="#DC2626" filter={`url(#hollyGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0s'}}/>
            <circle cx="40" cy="40" r="8" fill="#FFFFFF" opacity="0.6"/>
            <circle cx={width - 40} cy="40" r="14" fill="#DC2626" filter={`url(#hollyGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.4s'}}/>
            <circle cx={width - 40} cy="40" r="8" fill="#FFFFFF" opacity="0.6"/>
            <circle cx="40" cy={height - 40} r="14" fill="#DC2626" filter={`url(#hollyGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '0.8s'}}/>
            <circle cx="40" cy={height - 40} r="8" fill="#FFFFFF" opacity="0.6"/>
            <circle cx={width - 40} cy={height - 40} r="14" fill="#DC2626" filter={`url(#hollyGlow-${width}-${height})`} className="animate-twinkle" style={{animationDelay: '1.2s'}}/>
            <circle cx={width - 40} cy={height - 40} r="8" fill="#FFFFFF" opacity="0.6"/>
            
            {/* Enhanced gold ribbon */}
            <rect x={width / 2 - 80} y="25" width="160" height="12" fill="#F59E0B" rx="6" filter={`url(#hollyGlow-${width}-${height})`} className="animate-float"/>
            <rect x={width / 2 - 80} y={height - 37} width="160" height="12" fill="#F59E0B" rx="6" filter={`url(#hollyGlow-${width}-${height})`} className="animate-float" style={{animationDelay: '1s'}}/>
            
            {/* Text */}
            <text x={width / 2} y="55" textAnchor="middle" fill="#FEF3C7" fontSize={Math.min(30, width / 28)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#hollyGlow-${width}-${height})`} className="animate-float">
              <tspan x={width / 2} y="55" fill="#065F46" opacity="0.3" dx="-2" dy="2">Joy to the World</tspan>
              <tspan x={width / 2} y="55" fill="#FEF3C7">Joy to the World</tspan>
            </text>
          </svg>
        );
      }
    },
    {
      id: 5,
      name: "Santa Hat & Beard",
      component: ({ width, height }) => {
        const gradientId = `santaGrad-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#DC2626" stopOpacity="1"/>
                <stop offset="50%" stopColor="#EF4444" stopOpacity="1"/>
                <stop offset="100%" stopColor="#B91C1C" stopOpacity="1"/>
              </linearGradient>
              <filter id={`santaGlow-${width}-${height}`}>
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Enhanced Santa hat with gradient */}
            <path d={`M${width / 2 - 120},100 L${width / 2},15 L${width / 2 + 120},100 Z`} fill={`url(#${gradientId})`} filter={`url(#santaGlow-${width}-${height})`} className="animate-float"/>
            <circle cx={width / 2} cy="15" r="18" fill="#FFFFFF" filter={`url(#santaGlow-${width}-${height})`} className="animate-twinkle"/>
            <circle cx={width / 2} cy="15" r="10" fill="#F59E0B" opacity="0.8"/>
            <rect x={width / 2 - 140} y="100" width="280" height="25" fill="#FFFFFF" rx="5" filter={`url(#santaGlow-${width}-${height})`}/>
            <rect x={width / 2 - 140} y="100" width="280" height="8" fill="#F59E0B" rx="2"/>
            
            {/* Enhanced beard with texture */}
            <ellipse cx={width / 2} cy={height - 70} rx="140" ry="50" fill="#FFFFFF" opacity="0.95" filter={`url(#santaGlow-${width}-${height})`} className="animate-float" style={{animationDelay: '0.5s'}}/>
            <ellipse cx={width / 2} cy={height - 70} rx="120" ry="40" fill="#F3F4F6" opacity="0.7"/>
            
            {/* Border accents with glow */}
            <rect x="0" y="0" width={width} height="15" fill={`url(#${gradientId})`} filter={`url(#santaGlow-${width}-${height})`}/>
            <rect x="0" y={height - 15} width={width} height="15" fill={`url(#${gradientId})`} filter={`url(#santaGlow-${width}-${height})`}/>
            
            {/* Snowflakes decoration */}
            {[...Array(6)].map((_, i) => (
              <circle key={i} cx={width / 2 + (i - 2.5) * 50} cy="130" r="3" fill="#FFFFFF" opacity="0.8" className="animate-twinkle" style={{animationDelay: `${i * 0.2}s`}}/>
            ))}
            
            {/* Text */}
            <text x={width / 2} y="125" textAnchor="middle" fill="#FEF3C7" fontSize={Math.min(28, width / 30)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#santaGlow-${width}-${height})`} className="animate-float">
              <tspan x={width / 2} y="125" fill="#DC2626" opacity="0.3" dx="-2" dy="2">Believe in the Magic</tspan>
              <tspan x={width / 2} y="125" fill="#FEF3C7">Believe in the Magic</tspan>
            </text>
          </svg>
        );
      }
    },
    {
      id: 6,
      name: "Reindeer Antlers",
      component: ({ width, height }) => {
        const gradientId = `reindeerGrad-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#92400E" stopOpacity="0.9"/>
                <stop offset="50%" stopColor="#A16207" stopOpacity="1"/>
                <stop offset="100%" stopColor="#78350F" stopOpacity="0.9"/>
              </linearGradient>
              <filter id={`reindeerGlow-${width}-${height}`}>
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Enhanced antlers with glow */}
            <path d={`M${width / 2 - 90},70 L${width / 2 - 140},25 L${width / 2 - 110},45`} stroke={`url(#${gradientId})`} strokeWidth="10" fill="none" strokeLinecap="round" filter={`url(#reindeerGlow-${width}-${height})`} className="animate-float"/>
            <path d={`M${width / 2 - 90},70 L${width / 2 - 110},45 L${width / 2 - 100},55`} stroke={`url(#${gradientId})`} strokeWidth="8" fill="none" strokeLinecap="round" filter={`url(#reindeerGlow-${width}-${height})`}/>
            <path d={`M${width / 2 + 90},70 L${width / 2 + 140},25 L${width / 2 + 110},45`} stroke={`url(#${gradientId})`} strokeWidth="10" fill="none" strokeLinecap="round" filter={`url(#reindeerGlow-${width}-${height})`} className="animate-float" style={{animationDelay: '0.3s'}}/>
            <path d={`M${width / 2 + 90},70 L${width / 2 + 110},45 L${width / 2 + 100},55`} stroke={`url(#${gradientId})`} strokeWidth="8" fill="none" strokeLinecap="round" filter={`url(#reindeerGlow-${width}-${height})`}/>
            
            {/* Enhanced red nose with glow */}
            <circle cx={width / 2} cy={height - 90} r="30" fill="#DC2626" filter={`url(#reindeerGlow-${width}-${height})`} className="animate-twinkle"/>
            <circle cx={width / 2} cy={height - 90} r="20" fill="#EF4444" opacity="0.8"/>
            <circle cx={width / 2} cy={height - 90} r="12" fill="#FFFFFF" opacity="0.9"/>
            <circle cx={width / 2 - 5} cy={height - 93} r="3" fill="#000000" opacity="0.6"/>
            <circle cx={width / 2 + 5} cy={height - 93} r="3" fill="#000000" opacity="0.6"/>
            
            {/* Enhanced border */}
            <rect x="0" y="0" width={width} height="20" fill={`url(#${gradientId})`} rx="5" filter={`url(#reindeerGlow-${width}-${height})`}/>
            <rect x="0" y={height - 20} width={width} height="20" fill={`url(#${gradientId})`} rx="5" filter={`url(#reindeerGlow-${width}-${height})`}/>
            
            {/* Decorative elements */}
            <circle cx={width / 2 - 60} cy="50" r="4" fill="#F59E0B" className="animate-twinkle" style={{animationDelay: '0s'}}/>
            <circle cx={width / 2 + 60} cy="50" r="4" fill="#F59E0B" className="animate-twinkle" style={{animationDelay: '0.5s'}}/>
            
            {/* Text */}
            <text x={width / 2} y="110" textAnchor="middle" fill="#92400E" fontSize={Math.min(30, width / 28)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#reindeerGlow-${width}-${height})`} className="animate-float">
              <tspan x={width / 2} y="110" fill="#FFFFFF" opacity="0.4" dx="-2" dy="2">Have a Jolly Christmas</tspan>
              <tspan x={width / 2} y="110" fill="#92400E">Have a Jolly Christmas</tspan>
            </text>
          </svg>
        );
      }
    },
    {
      id: 7,
      name: "Festive Lights",
      component: ({ width, height }) => {
        const filterId = `glow-${width}-${height}`;
        const darkFilterId = `darkGlow-${width}-${height}`;
        return (
          <svg width={width} height={height} className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-breathe">
            <defs>
              <filter id={filterId}>
                <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id={darkFilterId}>
                <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Dark background border for contrast */}
            <rect x="0" y="0" width={width} height="50" fill="#1F2937" opacity="0.8" rx="5"/>
            <rect x="0" y={height - 50} width={width} height="50" fill="#1F2937" opacity="0.8" rx="5"/>
            <rect x="0" y="0" width="50" height={height} fill="#1F2937" opacity="0.8" rx="5"/>
            <rect x={width - 50} y="0" width="50" height={height} fill="#1F2937" opacity="0.8" rx="5"/>
            
            {/* Enhanced string lights with stronger glow */}
            {[...Array(12)].map((_, i) => {
              const color = i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857';
              return (
                <g key={i}>
                  <circle cx={i * (width / 12) + (width / 24)} cy="35" r="16" fill={color} filter={`url(#${darkFilterId})`} opacity="0.6" className="animate-twinkle" style={{animationDelay: `${i * 0.1}s`}}/>
                  <circle cx={i * (width / 12) + (width / 24)} cy="35" r="14" fill={color} filter={`url(#${filterId})`} opacity="1" className="animate-twinkle" style={{animationDelay: `${i * 0.1}s`}}/>
                  <circle cx={i * (width / 12) + (width / 24)} cy="35" r="8" fill="#FFFFFF" opacity="0.9"/>
                </g>
              );
            })}
            {[...Array(12)].map((_, i) => {
              const color = i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857';
              return (
                <g key={i}>
                  <circle cx={i * (width / 12) + (width / 24)} cy={height - 35} r="16" fill={color} filter={`url(#${darkFilterId})`} opacity="0.6" className="animate-twinkle" style={{animationDelay: `${(i + 12) * 0.1}s`}}/>
                  <circle cx={i * (width / 12) + (width / 24)} cy={height - 35} r="14" fill={color} filter={`url(#${filterId})`} opacity="1" className="animate-twinkle" style={{animationDelay: `${(i + 12) * 0.1}s`}}/>
                  <circle cx={i * (width / 12) + (width / 24)} cy={height - 35} r="8" fill="#FFFFFF" opacity="0.9"/>
                </g>
              );
            })}
            {[...Array(8)].map((_, i) => {
              const color = i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857';
              return (
                <g key={i}>
                  <circle cx="35" cy={i * (height / 8) + (height / 16)} r="16" fill={color} filter={`url(#${darkFilterId})`} opacity="0.6" className="animate-twinkle" style={{animationDelay: `${(i + 24) * 0.1}s`}}/>
                  <circle cx="35" cy={i * (height / 8) + (height / 16)} r="14" fill={color} filter={`url(#${filterId})`} opacity="1" className="animate-twinkle" style={{animationDelay: `${(i + 24) * 0.1}s`}}/>
                  <circle cx="35" cy={i * (height / 8) + (height / 16)} r="8" fill="#FFFFFF" opacity="0.9"/>
                </g>
              );
            })}
            {[...Array(8)].map((_, i) => {
              const color = i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857';
              return (
                <g key={i}>
                  <circle cx={width - 35} cy={i * (height / 8) + (height / 16)} r="16" fill={color} filter={`url(#${darkFilterId})`} opacity="0.6" className="animate-twinkle" style={{animationDelay: `${(i + 32) * 0.1}s`}}/>
                  <circle cx={width - 35} cy={i * (height / 8) + (height / 16)} r="14" fill={color} filter={`url(#${filterId})`} opacity="1" className="animate-twinkle" style={{animationDelay: `${(i + 32) * 0.1}s`}}/>
                  <circle cx={width - 35} cy={i * (height / 8) + (height / 16)} r="8" fill="#FFFFFF" opacity="0.9"/>
                </g>
              );
            })}
            
            {/* Connecting wire effect */}
            <path d={`M${width / 24},35 L${width - width / 24},35`} stroke="#374151" strokeWidth="2" opacity="0.5"/>
            <path d={`M${width / 24},${height - 35} L${width - width / 24},${height - 35}`} stroke="#374151" strokeWidth="2" opacity="0.5"/>
            <path d={`M35,${height / 16} L35,${height - height / 16}`} stroke="#374151" strokeWidth="2" opacity="0.5"/>
            <path d={`M${width - 35},${height / 16} L${width - 35},${height - height / 16}`} stroke="#374151" strokeWidth="2" opacity="0.5"/>
            
            {/* Text */}
            <text x={width / 2} y="70" textAnchor="middle" fill="#FEF3C7" fontSize={Math.min(32, width / 26)} fontWeight="bold" fontFamily="Arial, sans-serif" filter={`url(#${filterId})`} className="animate-float">
              <tspan x={width / 2} y="70" fill="#1F2937" opacity="0.4" dx="-2" dy="2">Light Up the Season</tspan>
              <tspan x={width / 2} y="70" fill="#FEF3C7">Light Up the Season</tspan>
            </text>
          </svg>
        );
      }
    }
  ];

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);
      const constraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // IMPORTANT: Set step FIRST to trigger re-render and show camera screen
      // This must happen before setting up the video element
      setStep('camera');
      setCameraActive(true);
      
      // Set up video element after React renders the camera screen
      // Use multiple attempts to ensure it works
      const setupVideo = (attempt = 0) => {
        if (attempt > 10) {
          console.error('Failed to set up video after multiple attempts');
          setError('Failed to initialize camera. Please refresh and try again.');
          return;
        }
        
        const video = videoRef.current;
        const currentStream = streamRef.current;
        
        if (video && currentStream) {
          try {
            video.srcObject = currentStream;
            video.play().catch(err => {
              console.error('Error playing video:', err);
              setError('Failed to start camera. Please try again.');
            });
          } catch (err) {
            console.error('Error setting video srcObject:', err);
            setTimeout(() => setupVideo(attempt + 1), 50);
          }
        } else {
          // Video element not ready yet, try again
          setTimeout(() => setupVideo(attempt + 1), 50);
        }
      };
      
      // Start setup after a brief delay to ensure DOM is updated
      setTimeout(() => setupVideo(), 100);
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions and try again.');
      console.error('Camera error:', err);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Switch camera
  const switchCamera = async () => {
    stopCamera();
    setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(() => startCamera(), 100);
  };

  // Capture photo with countdown
  const capturePhoto = () => {
    if (countdown !== null) return;
    
    let count = 3;
    setCountdown(count);
    
    const countdownInterval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        setCountdown(null);
        clearInterval(countdownInterval);
        
        // Flash effect
        const flash = document.createElement('div');
        flash.className = 'fixed inset-0 bg-white z-50 opacity-75';
        flash.style.animation = 'flash 0.3s ease-out';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 300);
        
        // Capture
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
          const ctx = canvas.getContext('2d');
          const width = video.videoWidth;
          const height = video.videoHeight;
          canvas.width = width;
          canvas.height = height;
          
          // Draw video frame
          ctx.drawImage(video, 0, 0, width, height);
          
          // Create SVG element for template overlay
          const svgString = getTemplateSVGString(selectedTemplate, width, height);
          const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(svgBlob);
          
          const img = new Image();
          img.onload = () => {
            // Draw template overlay on top of photo
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            
            // Convert canvas to image
            const imageData = canvas.toDataURL('image/png');
            setCapturedImage(imageData);
            setPhotoTaken(true);
            setStep('review');
            stopCamera();
          };
          img.src = url;
        }
      }
    }, 1000);
  };

  // Generate SVG string for template
  const getTemplateSVGString = (templateId, width, height) => {
    const template = templates[templateId];
    // This is a simplified approach - we'll create SVG strings for each template
    const svgTemplates = {
      0: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="candyCane" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#DC2626"/><rect x="0" y="0" width="20" height="40" fill="#FFFFFF"/>
        </pattern></defs>
        <rect x="0" y="0" width="${width}" height="60" fill="url(#candyCane)"/>
        <rect x="0" y="${height - 60}" width="${width}" height="60" fill="url(#candyCane)"/>
        <rect x="0" y="0" width="60" height="${height}" fill="url(#candyCane)"/>
        <rect x="${width - 60}" y="0" width="60" height="${height}" fill="url(#candyCane)"/>
        <circle cx="30" cy="30" r="15" fill="#F59E0B"/><circle cx="${width - 30}" cy="30" r="15" fill="#F59E0B"/>
        <circle cx="30" cy="${height - 30}" r="15" fill="#F59E0B"/><circle cx="${width - 30}" cy="${height - 30}" r="15" fill="#F59E0B"/>
        <text x="${width / 2}" y="40" text-anchor="middle" fill="#F59E0B" font-size="32" font-weight="bold" font-family="Arial">Ho Ho Ho!</text>
      </svg>`,
      1: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="50" fill="#E0F2FE" opacity="0.8"/>
        <rect x="0" y="${height - 50}" width="${width}" height="50" fill="#E0F2FE" opacity="0.8"/>
        <rect x="0" y="0" width="50" height="${height}" fill="#E0F2FE" opacity="0.8"/>
        <rect x="${width - 50}" y="0" width="50" height="${height}" fill="#E0F2FE" opacity="0.8"/>
        <text x="${width / 2}" y="35" text-anchor="middle" fill="#0EA5E9" font-size="28" font-weight="bold" font-family="Arial">Let it Snow</text>
      </svg>`,
      2: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="70" fill="#047857" opacity="0.9"/>
        <rect x="0" y="${height - 70}" width="${width}" height="70" fill="#047857" opacity="0.9"/>
        <rect x="0" y="0" width="70" height="${height}" fill="#047857" opacity="0.9"/>
        <rect x="${width - 70}" y="0" width="70" height="${height}" fill="#047857" opacity="0.9"/>
        <circle cx="35" cy="35" r="12" fill="#DC2626"/><circle cx="${width - 35}" cy="35" r="12" fill="#F59E0B"/>
        <circle cx="35" cy="${height - 35}" r="12" fill="#DC2626"/><circle cx="${width - 35}" cy="${height - 35}" r="12" fill="#F59E0B"/>
        <path d="M${width / 2},20 L${width / 2 - 15},35 L${width / 2 + 15},35 Z" fill="#F59E0B"/>
        <text x="${width / 2}" y="50" text-anchor="middle" fill="#FEF3C7" font-size="30" font-weight="bold" font-family="Arial">Merry Christmas</text>
      </svg>`,
      3: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="80" fill="#92400E" opacity="0.85"/>
        <rect x="0" y="${height - 80}" width="${width}" height="80" fill="#92400E" opacity="0.85"/>
        <rect x="0" y="0" width="80" height="${height}" fill="#92400E" opacity="0.85"/>
        <rect x="${width - 80}" y="0" width="80" height="${height}" fill="#92400E" opacity="0.85"/>
        <rect x="10" y="10" width="${width - 20}" height="10" fill="#FFFFFF" rx="5"/>
        <rect x="10" y="${height - 20}" width="${width - 20}" height="10" fill="#FFFFFF" rx="5"/>
        <rect x="10" y="10" width="10" height="${height - 20}" fill="#FFFFFF" rx="5"/>
        <rect x="${width - 20}" y="10" width="10" height="${height - 20}" fill="#FFFFFF" rx="5"/>
        <circle cx="40" cy="40" r="8" fill="#DC2626"/><circle cx="${width - 40}" cy="40" r="8" fill="#F59E0B"/>
        <circle cx="40" cy="${height - 40}" r="8" fill="#DC2626"/><circle cx="${width - 40}" cy="${height - 40}" r="8" fill="#F59E0B"/>
        <text x="${width / 2}" y="55" text-anchor="middle" fill="#FEF3C7" font-size="28" font-weight="bold" font-family="Arial">Sweet Holidays</text>
      </svg>`,
      4: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="60" fill="#065F46" opacity="0.9"/>
        <rect x="0" y="${height - 60}" width="${width}" height="60" fill="#065F46" opacity="0.9"/>
        <rect x="0" y="0" width="60" height="${height}" fill="#065F46" opacity="0.9"/>
        <rect x="${width - 60}" y="0" width="60" height="${height}" fill="#065F46" opacity="0.9"/>
        <circle cx="30" cy="30" r="10" fill="#DC2626"/><circle cx="${width - 30}" cy="30" r="10" fill="#DC2626"/>
        <circle cx="30" cy="${height - 30}" r="10" fill="#DC2626"/><circle cx="${width - 30}" cy="${height - 30}" r="10" fill="#DC2626"/>
        <rect x="${width / 2 - 60}" y="20" width="120" height="8" fill="#F59E0B" rx="4"/>
        <rect x="${width / 2 - 60}" y="${height - 28}" width="120" height="8" fill="#F59E0B" rx="4"/>
        <text x="${width / 2}" y="45" text-anchor="middle" fill="#FEF3C7" font-size="26" font-weight="bold" font-family="Arial">Joy to the World</text>
      </svg>`,
      5: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <path d="M${width / 2 - 100},80 L${width / 2},20 L${width / 2 + 100},80 Z" fill="#DC2626"/>
        <circle cx="${width / 2}" cy="20" r="15" fill="#FFFFFF"/>
        <rect x="${width / 2 - 120}" y="80" width="240" height="20" fill="#FFFFFF"/>
        <ellipse cx="${width / 2}" cy="${height - 60}" rx="120" ry="40" fill="#FFFFFF" opacity="0.9"/>
        <rect x="0" y="0" width="${width}" height="10" fill="#DC2626"/>
        <rect x="0" y="${height - 10}" width="${width}" height="10" fill="#DC2626"/>
        <text x="${width / 2}" y="110" text-anchor="middle" fill="#FEF3C7" font-size="24" font-weight="bold" font-family="Arial">Believe in the Magic</text>
      </svg>`,
      6: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <path d="M${width / 2 - 80},60 L${width / 2 - 120},30 L${width / 2 - 100},50" stroke="#92400E" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M${width / 2 - 80},60 L${width / 2 - 100},40 L${width / 2 - 90},50" stroke="#92400E" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M${width / 2 + 80},60 L${width / 2 + 120},30 L${width / 2 + 100},50" stroke="#92400E" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M${width / 2 + 80},60 L${width / 2 + 100},40 L${width / 2 + 90},50" stroke="#92400E" stroke-width="6" fill="none" stroke-linecap="round"/>
        <circle cx="${width / 2}" cy="${height - 80}" r="25" fill="#DC2626"/>
        <circle cx="${width / 2}" cy="${height - 80}" r="15" fill="#FFFFFF"/>
        <rect x="0" y="0" width="${width}" height="15" fill="#92400E" opacity="0.7"/>
        <rect x="0" y="${height - 15}" width="${width}" height="15" fill="#92400E" opacity="0.7"/>
        <text x="${width / 2}" y="100" text-anchor="middle" fill="#92400E" font-size="26" font-weight="bold" font-family="Arial">Have a Jolly Christmas</text>
      </svg>`,
      7: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        ${[...Array(12)].map((_, i) => `<circle cx="${i * (width / 12) + (width / 24)}" cy="30" r="12" fill="${i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857'}" filter="url(#glow)" opacity="0.9"/>`).join('')}
        ${[...Array(12)].map((_, i) => `<circle cx="${i * (width / 12) + (width / 24)}" cy="${height - 30}" r="12" fill="${i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857'}" filter="url(#glow)" opacity="0.9"/>`).join('')}
        ${[...Array(8)].map((_, i) => `<circle cx="30" cy="${i * (height / 8) + (height / 16)}" r="12" fill="${i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857'}" filter="url(#glow)" opacity="0.9"/>`).join('')}
        ${[...Array(8)].map((_, i) => `<circle cx="${width - 30}" cy="${i * (height / 8) + (height / 16)}" r="12" fill="${i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#F59E0B' : '#047857'}" filter="url(#glow)" opacity="0.9"/>`).join('')}
        <text x="${width / 2}" y="60" text-anchor="middle" fill="#FEF3C7" font-size="28" font-weight="bold" font-family="Arial">Light Up the Season</text>
      </svg>`
    };
    return svgTemplates[templateId] || svgTemplates[0];
  };

  // Retake photo
  const retakePhoto = () => {
    setPhotoTaken(false);
    setCapturedImage(null);
    setStep('camera');
    startCamera();
  };

  // Confetti effect on template selection
  const createConfetti = useCallback((element) => {
    const colors = ['#DC2626', '#059669', '#F59E0B', '#FFFFFF'];
    const rect = element?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 20; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'fixed pointer-events-none z-50 w-2 h-2 rounded-full';
      confetti.style.left = `${centerX}px`;
      confetti.style.top = `${centerY}px`;
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      
      document.body.appendChild(confetti);
      
      const angle = (Math.PI * 2 * i) / 20;
      const velocity = 3 + Math.random() * 2;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;
      
      confetti.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${vx * 50}px, ${vy * 50 + 100}px) scale(0)`, opacity: 0 }
      ], {
        duration: 800,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }).onfinish = () => confetti.remove();
    }
  }, []);

  // Enhanced template selection with animations
  const handleTemplateSelect = useCallback((index) => {
    if (index === selectedTemplate || isTransitioning) return;
    
    const element = templateRefs.current[index];
    if (element) {
      createConfetti(element);
    }
    
    setPreviousTemplate(selectedTemplate);
    setIsTransitioning(true);
    setSelectedTemplate(index);
    
    // Scroll to center on mobile carousel
    if (carouselRef.current) {
      const templateElement = templateRefs.current[index];
      if (templateElement) {
        templateElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    
    setTimeout(() => setIsTransitioning(false), 450);
  }, [selectedTemplate, isTransitioning, createConfetti]);

  // Carousel navigation
  const scrollCarousel = useCallback((direction) => {
    if (!carouselRef.current) return;
    const scrollAmount = 250;
    carouselRef.current.scrollBy({
      left: direction === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (step !== 'camera') return;
      
      if (e.key === 'ArrowLeft') {
        const newIndex = selectedTemplate > 0 ? selectedTemplate - 1 : templates.length - 1;
        handleTemplateSelect(newIndex);
      } else if (e.key === 'ArrowRight') {
        const newIndex = selectedTemplate < templates.length - 1 ? selectedTemplate + 1 : 0;
        handleTemplateSelect(newIndex);
      } else if (e.key >= '1' && e.key <= '8') {
        const numIndex = parseInt(e.key) - 1;
        if (numIndex < templates.length) {
          handleTemplateSelect(numIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [step, selectedTemplate, handleTemplateSelect]);

  // Download photo
  const downloadPhoto = () => {
    if (capturedImage) {
      const link = document.createElement('a');
      link.download = `christmas-photo-${Date.now()}.png`;
      link.href = capturedImage;
      link.click();
    }
  };

  // Setup video when step changes to camera and stream is available (backup)
  useEffect(() => {
    if (step === 'camera' && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Snowfall animation component
  const Snowfall = () => {
    const snowflakes = [...Array(60)].map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 5 + Math.random() * 5,
      size: Math.random() * 0.5 + 0.5,
      opacity: Math.random() * 0.3 + 0.4
    }));

    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute text-white animate-snow"
            style={{
              left: `${flake.left}%`,
              animationDelay: `${flake.delay}s`,
              animationDuration: `${flake.duration}s`,
              opacity: flake.opacity,
              fontSize: `${flake.size * 1.5}rem`
            }}
          >
            ❄
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-green-900 to-red-800 relative overflow-hidden">
      <Snowfall />
      
      {/* Custom animations */}
      <style>{`
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 0.95; }
          100% { opacity: 0; }
        }
        @keyframes snow {
          0% { 
            transform: translateY(-100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% { 
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes countdownPop {
          0% { 
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes templateFade {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes templateFlipOut {
          0% { opacity: 1; transform: rotateY(0deg) scale(1); }
          100% { opacity: 0; transform: rotateY(90deg) scale(1.1); }
        }
        @keyframes templateFlipIn {
          0% { opacity: 0; transform: rotateY(-90deg) scale(0.9); }
          100% { opacity: 1; transform: rotateY(0deg) scale(1); }
        }
        @keyframes buttonPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes templateEntrance {
          0% { 
            opacity: 0; 
            transform: translateY(20px) scale(0.9);
            filter: blur(4px);
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes templateHover {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.15); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.5); }
          50% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.8); }
        }
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.95; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 5px currentColor); }
          50% { filter: drop-shadow(0 0 20px currentColor); }
        }
        @keyframes borderGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.5), inset 0 0 10px rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.8), inset 0 0 20px rgba(245, 158, 11, 0.5); }
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
        .animate-breathe {
          animation: breathe 3s ease-in-out infinite;
        }
        .animate-twinkle {
          animation: twinkle 2s ease-in-out infinite;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-glow-pulse {
          animation: glowPulse 2s ease-in-out infinite;
        }
        .frame-border-glow {
          animation: borderGlow 3s ease-in-out infinite;
        }
        .animate-snow {
          animation: snow linear infinite;
        }
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-countdown {
          animation: countdownPop 0.5s ease-out;
        }
        .template-fade {
          animation: templateFade 0.3s ease-out;
        }
        .template-flip-out {
          animation: templateFlipOut 0.25s ease-in;
        }
        .template-flip-in {
          animation: templateFlipIn 0.3s ease-out 0.15s both;
        }
        .button-pulse {
          animation: buttonPulse 2s ease-in-out infinite;
        }
        .template-entrance {
          animation: templateEntrance 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .template-hover-effect {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .template-hover-effect:hover {
          transform: translateY(-8px) scale(1.15);
        }
        .template-selected {
          animation: glowPulse 2s ease-in-out infinite;
        }
        .carousel-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .carousel-container::-webkit-scrollbar {
          display: none;
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-2 drop-shadow-lg">
            🎄 Christmas Photo Booth 🎅
          </h1>
          <p className="text-xl md:text-2xl text-yellow-200 font-semibold">
            Capture Your Holiday Magic!
          </p>
        </header>

        {/* Welcome Screen */}
        {step === 'welcome' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-12 shadow-2xl border-2 border-yellow-300/30">
              <div className="text-6xl mb-6 animate-pulse-slow">📸✨</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Welcome to Your Christmas Photo Booth!
              </h2>
              <p className="text-lg text-yellow-100 mb-8">
                Select from 8 festive templates, capture your photo, and create magical holiday memories!
              </p>
              <button
                onClick={startCamera}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xl font-bold py-4 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2 mx-auto"
              >
                <Camera className="w-6 h-6" />
                Start Photo Booth
              </button>
            </div>
          </div>
        )}

        {/* Camera Screen */}
        {step === 'camera' && (
          <div className="max-w-[95vw] xl:max-w-7xl mx-auto" key="camera-screen">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 md:p-8 shadow-2xl">
              <h3 className="text-3xl font-bold text-white mb-8 text-center drop-shadow-lg">
                🎄 Choose Your Magic Frame ✨
              </h3>
              
              {/* Premium Carousel Layout - Desktop */}
              <div className="hidden lg:block mb-8">
                <div className="relative">
                  {/* Carousel Container */}
                  <div 
                    ref={carouselRef}
                    className="flex gap-6 overflow-x-auto carousel-container scroll-smooth pb-4 px-12"
                    style={{ scrollSnapType: 'x mandatory' }}
                  >
                    {templates.map((template, index) => {
                      const distance = Math.abs(index - selectedTemplate);
                      const scale = distance === 0 ? 1.2 : distance === 1 ? 0.9 : 0.7;
                      const opacity = distance === 0 ? 1 : distance === 1 ? 0.7 : 0.4;
                      const isSelected = selectedTemplate === index;
                      
                      return (
                        <button
                          key={template.id}
                          ref={el => templateRefs.current[index] = el}
                          onClick={() => handleTemplateSelect(index)}
                          onMouseEnter={() => setTemplateHovered(index)}
                          onMouseLeave={() => setTemplateHovered(null)}
                          className={`relative shrink-0 transition-all duration-500 ease-out template-entrance template-hover-effect ${
                            isSelected ? 'template-selected' : ''
                          }`}
                          style={{
                            animationDelay: `${index * 50}ms`,
                            transform: `scale(${scale}) ${distance !== 0 ? `rotateY(${index < selectedTemplate ? '15deg' : '-15deg'})` : ''}`,
                            opacity,
                            transformStyle: 'preserve-3d',
                            scrollSnapAlign: 'center',
                            width: distance === 0 ? '280px' : distance === 1 ? '200px' : '160px'
                          }}
                        >
                          <div className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
                            isSelected
                              ? 'border-yellow-400 bg-yellow-400/20 shadow-2xl shadow-yellow-400/50 ring-4 ring-yellow-400 ring-opacity-50'
                              : 'border-white/30 bg-white/5 hover:border-yellow-300 hover:bg-yellow-300/10'
                          }`}>
                            <div className="aspect-square bg-gradient-to-br from-red-100 to-green-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                              {React.createElement(template.component, { 
                                width: distance === 0 ? 200 : distance === 1 ? 150 : 120, 
                                height: distance === 0 ? 200 : distance === 1 ? 150 : 120 
                              })}
                            </div>
                            <p className={`text-white font-bold mt-3 text-center transition-all duration-300 ${
                              isSelected ? 'text-lg text-yellow-300' : 'text-sm'
                            }`}>
                              {template.name}
                            </p>
                            {isSelected && (
                              <div className="absolute -top-2 -right-2 bg-yellow-400 text-red-900 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm animate-pulse">
                                ✓
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Navigation Arrows */}
                  <button
                    onClick={() => scrollCarousel('prev')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-3 transition-all duration-300 transform hover:scale-110 z-10"
                    aria-label="Previous template"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => scrollCarousel('next')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full p-3 transition-all duration-300 transform hover:scale-110 z-10"
                    aria-label="Next template"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                  
                  {/* Pagination Dots */}
                  <div className="flex justify-center gap-2 mt-6">
                    {templates.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleTemplateSelect(index)}
                        className={`transition-all duration-300 rounded-full ${
                          selectedTemplate === index
                            ? 'w-8 h-2 bg-yellow-400'
                            : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                        }`}
                        aria-label={`Go to template ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile Carousel Layout */}
              <div className="lg:hidden mb-6">
                <div className="relative">
                  <div 
                    ref={carouselRef}
                    className="flex gap-4 overflow-x-auto carousel-container scroll-smooth pb-4"
                    style={{ scrollSnapType: 'x mandatory' }}
                  >
                    {templates.map((template, index) => {
                      const distance = Math.abs(index - selectedTemplate);
                      const scale = distance === 0 ? 1.1 : 0.85;
                      const isSelected = selectedTemplate === index;
                      
                      return (
                        <button
                          key={template.id}
                          ref={el => templateRefs.current[index] = el}
                          onClick={() => handleTemplateSelect(index)}
                          className={`relative shrink-0 transition-all duration-500 ease-out template-entrance ${
                            isSelected ? 'template-selected' : ''
                          }`}
                          style={{
                            animationDelay: `${index * 50}ms`,
                            transform: `scale(${scale})`,
                            scrollSnapAlign: 'center',
                            width: isSelected ? '200px' : '160px'
                          }}
                        >
                          <div className={`relative p-3 rounded-xl border-2 transition-all duration-300 ${
                            isSelected
                              ? 'border-yellow-400 bg-yellow-400/20 shadow-xl shadow-yellow-400/50 ring-2 ring-yellow-400 ring-opacity-50'
                              : 'border-white/30 bg-white/5'
                          }`}>
                            <div className="aspect-square bg-gradient-to-br from-red-100 to-green-100 rounded-lg flex items-center justify-center relative overflow-hidden">
                              {React.createElement(template.component, { width: 140, height: 140 })}
                            </div>
                            <p className={`text-white font-semibold mt-2 text-center text-xs ${
                              isSelected ? 'text-yellow-300' : ''
                            }`}>
                              {template.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Mobile Pagination */}
                  <div className="flex justify-center gap-2 mt-4">
                    {templates.map((_, index) => (
                      <div
                        key={index}
                        className={`transition-all duration-300 rounded-full ${
                          selectedTemplate === index
                            ? 'w-6 h-1.5 bg-yellow-400'
                            : 'w-1.5 h-1.5 bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Camera Preview - Center */}
              <div className="w-full max-w-5xl mx-auto">
                <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto max-h-[75vh] object-cover"
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.play().catch(err => {
                          console.error('Error playing video:', err);
                        });
                      }
                    }}
                  />
                  {cameraActive && !photoTaken && (
                    <div className="absolute inset-0 pointer-events-none">
                      {isTransitioning ? (
                        <>
                          <div className="template-flip-out">
                            {React.createElement(templates[previousTemplate].component, {
                              width: videoRef.current?.videoWidth || 1280,
                              height: videoRef.current?.videoHeight || 720
                            })}
                          </div>
                          <div className="template-flip-in">
                            {React.createElement(templates[selectedTemplate].component, {
                              width: videoRef.current?.videoWidth || 1280,
                              height: videoRef.current?.videoHeight || 720
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="template-fade">
                          {React.createElement(templates[selectedTemplate].component, {
                            width: videoRef.current?.videoWidth || 1280,
                            height: videoRef.current?.videoHeight || 720
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 backdrop-blur-sm">
                      <div className="text-9xl font-bold text-white animate-countdown drop-shadow-2xl" style={{textShadow: '0 0 30px rgba(255,255,255,0.8)'}}>
                        {countdown}
                      </div>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                
                {/* Controls - Directly below camera with 2-3rem gap */}
                <div className="flex flex-wrap justify-center gap-4 mt-8 lg:mt-12">
                  <button
                    onClick={switchCamera}
                    className="bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-110 hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Switch Camera
                  </button>
                  <button
                    onClick={capturePhoto}
                    disabled={countdown !== null}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xl font-bold py-4 px-8 rounded-full shadow-lg transform hover:scale-110 hover:-translate-y-1 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed button-pulse"
                  >
                    <Camera className="w-6 h-6" />
                    {countdown !== null ? `Capturing in ${countdown}...` : 'Say Cheese! 🧀✨'}
                  </button>
                  <button
                    onClick={() => {
                      stopCamera();
                      setStep('welcome');
                      setPhotoTaken(false);
                    }}
                    className="bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-110 hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Screen */}
        {step === 'review' && capturedImage && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 md:p-8 shadow-2xl">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">
                Your Holiday Memory! 🎉
              </h2>
              
              {/* Captured Photo */}
              <div className="relative mb-6 rounded-2xl overflow-hidden bg-black">
                <img
                  src={capturedImage}
                  alt="Captured photo"
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={retakePhoto}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retake Photo
                </button>
                <button
                  onClick={() => {
                    setStep('camera');
                    startCamera();
                  }}
                  className="bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                >
                  Change Template
                </button>
                <button
                  onClick={downloadPhoto}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                >
                  <Download className="w-6 h-6" />
                  Download Photo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mt-6 bg-red-900/80 backdrop-blur-md rounded-xl p-6 border-2 border-red-500">
            <p className="text-white text-lg font-semibold mb-2">⚠️ Camera Access Issue</p>
            <p className="text-red-100">{error}</p>
            <p className="text-red-200 text-sm mt-4">
              Please check your browser settings and allow camera permissions, then refresh the page.
            </p>
            <button
              onClick={() => {
                setError(null);
                setStep('welcome');
              }}
              className="mt-4 bg-white text-red-800 font-bold py-2 px-6 rounded-full hover:bg-gray-100 transition-all"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChristmasPhotoBooth;

