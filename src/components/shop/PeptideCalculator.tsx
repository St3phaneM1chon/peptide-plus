'use client';

import { useState, useMemo } from 'react';

interface PeptideCalculatorProps {
  className?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export default function PeptideCalculator({ className = '', onClose, isModal = false }: PeptideCalculatorProps) {
  // États des inputs avec sliders
  const [peptideAmount, setPeptideAmount] = useState(10); // mg (1-500)
  const [solventVolume, setSolventVolume] = useState(3); // ml (1-10)
  const [desiredDose, setDesiredDose] = useState(2); // valeur selon l'unité
  const [doseUnit, setDoseUnit] = useState<'mcg' | 'mg'>('mg');

  // Calculs
  const calculations = useMemo(() => {
    // Concentration en mg/ml
    const concentrationMgPerMl = peptideAmount / solventVolume;
    
    // Dose désirée en mg
    const doseInMg = doseUnit === 'mg' ? desiredDose : desiredDose / 1000;
    
    // Volume à injecter en ml
    const volumeToInjectMl = doseInMg / concentrationMgPerMl;
    
    // Conversion en unités U100 (1ml = 100 unités)
    const unitsU100 = volumeToInjectMl * 100;
    
    return {
      concentrationMgPerMl,
      volumeToInjectMl,
      unitsU100,
    };
  }, [peptideAmount, solventVolume, desiredDose, doseUnit]);

  // Composant Slider compact
  const CompactSlider = ({ 
    value, 
    onChange, 
    min, 
    max, 
    step = 1,
    color = 'orange',
    label,
  }: { 
    value: number; 
    onChange: (v: number) => void; 
    min: number; 
    max: number; 
    step?: number;
    color?: 'orange' | 'white' | 'yellow';
    label: string;
  }) => {
    const colors = {
      orange: {
        button: 'bg-orange-500 hover:bg-orange-400',
        text: 'text-orange-400',
        track: '#f97316',
      },
      white: {
        button: 'bg-white hover:bg-gray-200',
        text: 'text-white',
        track: '#ffffff',
      },
      yellow: {
        button: 'bg-yellow-400 hover:bg-yellow-300',
        text: 'text-yellow-400',
        track: '#facc15',
      },
    };

    const decrease = () => {
      const newVal = Math.max(min, value - step);
      onChange(Number(newVal.toFixed(1)));
    };

    const increase = () => {
      const newVal = Math.min(max, value + step);
      onChange(Number(newVal.toFixed(1)));
    };

    const buttonTextColor = color === 'white' ? 'text-neutral-900' : 'text-white';

    return (
      <div className="w-full">
        {/* Boutons +/- et valeur */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <button
            onClick={decrease}
            className={`w-7 h-7 rounded-full ${colors[color].button} ${buttonTextColor} font-bold text-base flex items-center justify-center transition-all active:scale-95 shadow-lg`}
          >
            −
          </button>
          <div className="text-center min-w-[70px]">
            <span className={`text-xl font-bold ${colors[color].text}`}>{value}</span>
            <span className={`text-xs font-medium ml-1 ${colors[color].text}`}>{label}</span>
          </div>
          <button
            onClick={increase}
            className={`w-7 h-7 rounded-full ${colors[color].button} ${buttonTextColor} font-bold text-base flex items-center justify-center transition-all active:scale-95 shadow-lg`}
          >
            +
          </button>
        </div>
        
        {/* Slider natif stylisé - très fin */}
        <div className="relative px-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1 appearance-none cursor-pointer rounded-full bg-neutral-700/50
              [&::-webkit-slider-thumb]:appearance-none 
              [&::-webkit-slider-thumb]:w-3 
              [&::-webkit-slider-thumb]:h-3 
              [&::-webkit-slider-thumb]:rounded-full 
              [&::-webkit-slider-thumb]:bg-gradient-to-b 
              [&::-webkit-slider-thumb]:from-amber-300 
              [&::-webkit-slider-thumb]:to-amber-600 
              [&::-webkit-slider-thumb]:border 
              [&::-webkit-slider-thumb]:border-amber-200 
              [&::-webkit-slider-thumb]:shadow 
              [&::-webkit-slider-thumb]:cursor-grab
              [&::-webkit-slider-thumb]:active:cursor-grabbing
              [&::-moz-range-thumb]:w-3 
              [&::-moz-range-thumb]:h-3 
              [&::-moz-range-thumb]:rounded-full 
              [&::-moz-range-thumb]:bg-gradient-to-b 
              [&::-moz-range-thumb]:from-amber-300 
              [&::-moz-range-thumb]:to-amber-600 
              [&::-moz-range-thumb]:border 
              [&::-moz-range-thumb]:border-amber-200 
              [&::-moz-range-thumb]:cursor-grab
              [&::-moz-range-track]:h-1
              [&::-moz-range-track]:rounded-full
              [&::-moz-range-track]:bg-neutral-700/50"
            style={{
              background: `linear-gradient(to right, ${colors[color].track} 0%, ${colors[color].track} ${((value - min) / (max - min)) * 100}%, rgba(64,64,64,0.5) ${((value - min) / (max - min)) * 100}%, rgba(64,64,64,0.5) 100%)`
            }}
          />
        </div>
        
        {/* Labels min/max */}
        <div className="flex justify-between text-xs text-white/60 mt-0.5 px-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    );
  };

  const containerClasses = isModal 
    ? 'relative'
    : `relative ${className}`;

  return (
    <div className={containerClasses}>
      {/* Cadre principal */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-xl p-1 shadow-2xl w-full mx-auto">
        <div className="relative bg-gradient-to-br from-amber-900/30 via-neutral-900 to-amber-900/30 rounded-lg overflow-hidden">
          
          {/* Bandes d'avertissement en haut */}
          <div className="h-3 bg-repeat-x" style={{ 
            backgroundImage: 'repeating-linear-gradient(45deg, #000 0px, #000 10px, #f59e0b 10px, #f59e0b 20px)',
            backgroundSize: '28px 100%'
          }} />
          
          <div className="p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center border border-amber-500/50">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-white">Calculatrice de Peptides</h3>
                  <p className="text-sm text-amber-400/70">Calculez votre dosage précis</p>
                </div>
              </div>
              
              {/* Bouton fermer si modal */}
              {onClose && (
                <button 
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors border border-neutral-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Zone principale avec photo des vials en fond */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
              
              {/* Section des 3 vials avec image en fond */}
              <div className="lg:col-span-3 relative rounded-lg overflow-hidden">
                {/* Image de fond - les 3 vials */}
                <div 
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: 'url(/images/vials-photo.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                
                {/* Overlay sombre pour lisibilité */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
                
                {/* Contenu superposé */}
                <div className="relative z-10 p-4 md:p-6">
                  {/* Grille des 3 colonnes pour les contrôles */}
                  <div className="grid grid-cols-3 gap-2 md:gap-6">
                    
                    {/* ==================== COLONNE 1 - Quantité de peptide ==================== */}
                    <div className="flex flex-col items-center">
                      
                      {/* ===== GROUPE 1 - HEADER (Badge + Titre + Sous-titre) ===== */}
                      <div className="text-center" style={{ marginBottom: '56px' }}>
                        {/* Ligne 1: Badge numéroté */}
                        <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-orange-500 text-neutral-900 font-bold text-sm md:text-base shadow-lg mb-1">1</span>
                        {/* Ligne 2: Titre coloré */}
                        <p className="text-xs md:text-sm text-orange-400 font-semibold drop-shadow-lg">Quantité de peptide</p>
                        {/* Ligne 3: Sous-titre blanc */}
                        <p className="text-xs md:text-sm text-white font-bold drop-shadow-lg">dans le vial</p>
                      </div>
                      
                      {/* ===== GROUPE 2 - VALUES (Valeur affichée) ===== */}
                      <div className="flex items-center justify-center" style={{ marginLeft: '10px', marginBottom: '8px' }}>
                        <span className="text-2xl md:text-4xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{peptideAmount}</span>
                        <span className="text-sm md:text-lg text-orange-400 ml-1 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">mg</span>
                      </div>
                      
                      {/* ===== GROUPE 3 - CONTROLS (Boutons +/-, Slider, Toggle) ===== */}
                      <div className="w-full">
                        <CompactSlider 
                          value={peptideAmount} 
                          onChange={setPeptideAmount} 
                          min={1} 
                          max={500}
                          step={1}
                          color="orange"
                          label="mg"
                        />
                      </div>
                    </div>

                    {/* ==================== COLONNE 2 - Quantité de solvant ==================== */}
                    <div className="flex flex-col items-center">
                      
                      {/* ===== GROUPE 1 - HEADER (Badge + Titre + Sous-titre) ===== */}
                      <div className="text-center" style={{ marginBottom: '56px' }}>
                        <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-white text-neutral-900 font-bold text-sm md:text-base shadow-lg mb-1">2</span>
                        <p className="text-xs md:text-sm text-white font-semibold drop-shadow-lg">Quantité de solvant</p>
                        <p className="text-xs md:text-sm text-white font-bold drop-shadow-lg">eau bactériostatique</p>
                      </div>
                      
                      {/* ===== GROUPE 2 - VALUES (Valeur affichée) ===== */}
                      <div className="flex items-center justify-center" style={{ marginLeft: '10px', marginBottom: '8px' }}>
                        <span className="text-2xl md:text-4xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{solventVolume}</span>
                        <span className="text-sm md:text-lg text-gray-300 ml-1 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">mL</span>
                      </div>
                      
                      {/* ===== GROUPE 3 - CONTROLS (Boutons +/-, Slider) ===== */}
                      <div className="w-full">
                        <CompactSlider 
                          value={solventVolume} 
                          onChange={setSolventVolume} 
                          min={1} 
                          max={10}
                          step={0.5}
                          color="white"
                          label="mL"
                        />
                      </div>
                    </div>

                    {/* ==================== COLONNE 3 - Dosage désiré ==================== */}
                    <div className="flex flex-col items-center">
                      
                      {/* ===== GROUPE 1 - HEADER (Badge + Titre + Sous-titre) ===== */}
                      <div className="text-center" style={{ marginBottom: '56px' }}>
                        <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-yellow-400 text-neutral-900 font-bold text-sm md:text-base shadow-lg mb-1">3</span>
                        <p className="text-xs md:text-sm text-yellow-400 font-semibold drop-shadow-lg">Dosage désiré</p>
                        <p className="text-xs md:text-sm text-white font-bold drop-shadow-lg">par injection</p>
                      </div>
                      
                      {/* ===== GROUPE 2 - VALUES (Valeur affichée) ===== */}
                      <div className="flex items-center justify-center" style={{ marginLeft: '10px', marginBottom: '8px' }}>
                        <span className="text-2xl md:text-4xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{desiredDose}</span>
                        <span className="text-sm md:text-lg text-yellow-400 ml-1 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{doseUnit}</span>
                      </div>
                      
                      {/* ===== GROUPE 3 - CONTROLS (Boutons +/-, Slider, Toggle mcg/mg) ===== */}
                      <div className="w-full">
                        <CompactSlider 
                          value={desiredDose} 
                          onChange={setDesiredDose} 
                          min={doseUnit === 'mcg' ? 100 : 1} 
                          max={doseUnit === 'mcg' ? 1000 : 100}
                          step={doseUnit === 'mcg' ? 50 : 1}
                          color="yellow"
                          label={doseUnit}
                        />
                        
                        {/* Toggle mcg/mg */}
                        <div className="mt-2 flex justify-center">
                          <div className="flex items-center bg-black/30 rounded-full p-0.5 backdrop-blur-sm">
                            <button
                              onClick={() => {
                                setDoseUnit('mcg');
                                setDesiredDose(500);
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                doseUnit === 'mcg'
                                  ? 'bg-white/20 text-amber-400 shadow-inner'
                                  : 'text-white/60 hover:text-white'
                              }`}
                            >
                              mcg
                            </button>
                            <button
                              onClick={() => {
                                setDoseUnit('mg');
                                setDesiredDose(2);
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                doseUnit === 'mg'
                                  ? 'bg-amber-500 text-neutral-900 shadow-lg'
                                  : 'text-white/60 hover:text-white'
                              }`}
                            >
                              mg
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Résultat */}
              <div className="bg-neutral-900/90 rounded-xl p-4 h-full flex flex-col">
                <h4 className="text-lg font-bold text-white mb-3 text-center">Résultat</h4>
                
                {/* Concentration */}
                <div className="mb-2 p-2 bg-neutral-800/50 rounded-lg">
                  <p className="text-xs text-neutral-400 mb-0.5">Concentration :</p>
                  <p className="text-amber-400 whitespace-nowrap">
                    <span className="text-xl font-bold">{calculations.concentrationMgPerMl.toFixed(2)}</span>
                    <span className="text-xs ml-1">mg/mL</span>
                  </p>
                </div>
                
                {/* Volume à injecter */}
                <div className="mb-2 p-2 bg-neutral-800/50 rounded-lg">
                  <p className="text-xs text-neutral-400 mb-0.5">Volume à injecter :</p>
                  <p className="text-amber-400 whitespace-nowrap">
                    <span className="text-xl font-bold">{calculations.volumeToInjectMl.toFixed(2)}</span>
                    <span className="text-xs ml-1">mL</span>
                  </p>
                </div>
                
                {/* Unités à injecter */}
                {calculations.unitsU100 <= 100 ? (
                  <div className="p-3 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-lg flex-grow text-center">
                    <p className="text-xs text-neutral-400 mb-1">Unités à injecter</p>
                    <p className="text-4xl font-bold text-amber-400 mb-0.5">
                      {calculations.unitsU100.toFixed(1)}
                    </p>
                    <p className="text-xs text-neutral-500">unités (U-100)</p>
                  </div>
                ) : (
                  <div className="space-y-2 flex-grow">
                    <div className="p-1.5 bg-red-900/30 rounded flex items-center justify-center gap-1">
                      <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs text-red-400">Seringue 3 mL requise</span>
                    </div>
                    
                    <div className="p-3 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-lg text-center">
                      <p className="text-xs text-neutral-400 mb-1">Volume à injecter</p>
                      <p className="text-4xl font-bold text-blue-400 mb-0.5">
                        {calculations.volumeToInjectMl.toFixed(2)}
                      </p>
                      <p className="text-xs text-neutral-500">mL (seringue 3 mL)</p>
                      <p className="text-xs text-neutral-600 mt-1">
                        ({calculations.unitsU100.toFixed(0)} unités U-100)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-amber-600/70">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Cette calculatrice est fournie à titre informatif uniquement pour la recherche in vitro.</span>
            </div>
          </div>
          
          {/* Bandes d'avertissement en bas */}
          <div className="h-3 bg-repeat-x" style={{ 
            backgroundImage: 'repeating-linear-gradient(45deg, #000 0px, #000 10px, #f59e0b 10px, #f59e0b 20px)',
            backgroundSize: '28px 100%'
          }} />
        </div>
      </div>
    </div>
  );
}

// Version Modal de la calculatrice
export function PeptideCalculatorModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <PeptideCalculator onClose={onClose} isModal={true} />
      </div>
    </div>
  );
}
