import React, { useState, useRef, useCallback, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  size?: number;
  unit?: string;
  isPLocked?: boolean;
  disabled?: boolean;
  displayTransform?: (value: number) => string;
  className?: string;
}

const Knob: React.FC<KnobProps> = ({ label, value, min, max, step = 1, onChange, size = 50, unit = '', isPLocked = false, disabled = false, displayTransform, className = '' }) => {
  const dragState = useRef({
      isDragging: false,
      initialY: 0,
      initialValue: 0,
  }).current;

  const [isFineTuning, setIsFineTuning] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Shift' && !e.repeat) setIsFineTuning(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Shift') setIsFineTuning(false);
    };
    
    if (dragState.isDragging) {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    }

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [dragState.isDragging]);

  const valueToRotation = (val: number): number => {
    const numericVal = typeof val === 'number' && !isNaN(val) ? val : min;
    const clampedVal = Math.max(min, Math.min(max, numericVal));
    const progress = (clampedVal - min) / (max - min);
    const totalAngle = 270;
    const startAngle = -135;
    return startAngle + progress * totalAngle;
  };

  const rotation = valueToRotation(value);
  
  const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragState.isDragging || disabled) return;
    if ('preventDefault' in e) e.preventDefault();
    
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragState.initialY - currentY;
    
    const range = max - min;
    const sensitivity = 200;
    const fineTuneMultiplier = isFineTuning ? 0.1 : 1;
    const valueChange = (deltaY / sensitivity) * range * fineTuneMultiplier;
    
    let newValue = dragState.initialValue + valueChange;
    
    if (step > 0) {
      newValue = Math.round(newValue / step) * step;
    }
    
    newValue = Math.max(min, Math.min(max, newValue));

    const fixedPoints = step < 1 ? String(step).split('.')[1]?.length || 2 : 0;
    const formattedNewValue = parseFloat(newValue.toFixed(fixedPoints));

    onChange(formattedNewValue);
    
  }, [min, max, step, onChange, dragState, disabled, isFineTuning]);

  const handleInteractionEnd = useCallback(() => {
    dragState.isDragging = false;
    document.body.style.cursor = 'default';
    setIsFineTuning(false);

    window.removeEventListener('mousemove', handleInteractionMove);
    window.removeEventListener('touchmove', handleInteractionMove);
    window.removeEventListener('mouseup', handleInteractionEnd);
    window.removeEventListener('touchend', handleInteractionEnd);
  }, [handleInteractionMove, dragState]);

  const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    
    dragState.isDragging = true;
    dragState.initialY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragState.initialValue = typeof value === 'number' && !isNaN(value) ? value : min;
    
    if (e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey) {
        setIsFineTuning(true);
    }
    
    document.body.style.cursor = 'ns-resize';

    window.addEventListener('mousemove', handleInteractionMove);
    window.addEventListener('touchmove', handleInteractionMove, { passive: false });
    window.addEventListener('mouseup', handleInteractionEnd);
    window.addEventListener('touchend', handleInteractionEnd);
  }, [value, min, handleInteractionMove, handleInteractionEnd, dragState, disabled]);
  
  const formattedValue = () => {
      if (typeof value !== 'number' || isNaN(value)) return '---';
      if (displayTransform) return displayTransform(value);
      const fixedPoints = step < 1 ? (String(step).split('.')[1] || '').length : 0;
      return value.toFixed(fixedPoints);
  }

  const indicatorColor = isPLocked ? 'var(--plock-color)' : '#EAEAEA';

  return (
    <div className={`flex flex-col items-center justify-start space-y-1 select-none font-mono ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`} style={{ touchAction: 'none' }}>
      <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-display h-4 flex items-center">{label}</span>
      <div
        className={`relative rounded-full flex items-center justify-center bg-[#282828] border border-black/50 transition-shadow duration-150 ${disabled ? '' : 'cursor-ns-resize'}`}
        style={{ width: size, height: size, boxShadow: 'inset 0 1px 2px #000a, 0 1px 0px #444a' }}
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
      >
        <div
          className="absolute w-full h-full transition-transform duration-75"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div 
            className="absolute top-[10%] left-1/2 w-0.5 rounded-full"
            style={{
              height: '35%',
              transform: 'translateX(-50%)',
              backgroundColor: indicatorColor,
              boxShadow: `0 0 4px 1px ${indicatorColor}`
            }}
          />
        </div>
      </div>
       <div className="text-[11px] font-bold px-1.5 py-0.5 bg-[#111] rounded-sm flex items-center justify-center min-h-[20px] w-full text-center border border-black/50" style={{ color: 'var(--text-screen)' }}>
        <span>{formattedValue()}{!displayTransform && unit}</span>
      </div>
    </div>
  );
};

export default React.memo(Knob);
