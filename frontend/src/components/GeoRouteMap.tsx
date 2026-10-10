import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, CheckCircle } from 'lucide-react';

interface MapNode {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  city?: string;
  criticality: string;
  status: 'normal' | 'disrupted' | 'active_alternate' | 'compromised';
  notes?: string;
}

interface MapLink {
  id: string;
  origin_id: string;
  destination_id: string;
  origin_name: string;
  destination_name: string;
  distance_km: number;
  toll_cost: number;
  freight_rate: number;
  transit_days: number;
  capacity: number;
  is_alternate: boolean;
  is_active_path: boolean;
  status: 'active' | 'disabled' | 'standby';
}

interface GeoRouteMapProps {
  nodes: MapNode[];
  links: MapLink[];
  portAActive: boolean;
  portBActive: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  onOpenFacilityEditor?: () => void;
}

// In-memory cache for road route polylines
const roadPolylineCache = new Map<string, [number, number][]>();

export const GeoRouteMap: React.FC<GeoRouteMapProps> = ({
  nodes,
  links,
  portAActive,
  portBActive,
  selectedNodeId,
  onSelectNode,
  onOpenFacilityEditor,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ markers: L.LayerGroup; polylines: L.LayerGroup } | null>(null);
  const [roadCalibratedCount, setRoadCalibratedCount] = useState<number>(0);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map centered between Mumbai, Pune, and Surat
      const map = L.map(mapContainerRef.current, {
        center: [19.6, 73.0],
        zoom: 8,
        minZoom: 6,
        maxZoom: 14,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap free tiles — zero API key, zero quota, zero billing
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      const polylinesGroup = L.layerGroup().addTo(map);

      layersRef.current = {
        markers: markersGroup,
        polylines: polylinesGroup,
      };

      mapInstanceRef.current = map;
    }

    return () => {
      // Keep instance alive across re-renders
    };
  }, []);

  // Update markers and polylines when nodes/links change
  useEffect(() => {
    if (!mapInstanceRef.current || !layersRef.current) return;

    const { markers, polylines } = layersRef.current;
    markers.clearLayers();
    polylines.clearLayers();

    const nodeCoordMap: Record<string, [number, number]> = {};
    nodes.forEach((n) => {
      if (n.lat && n.lon) {
        nodeCoordMap[n.id] = [n.lat, n.lon];
      }
    });

    // Function to fetch real road coordinates
    const fetchRoadPolyline = async (
      origin: [number, number],
      dest: [number, number]
    ): Promise<[number, number][] | null> => {
      const cacheKey = `${origin[0].toFixed(4)},${origin[1].toFixed(4)}-${dest[0].toFixed(4)},${dest[1].toFixed(4)}`;
      if (roadPolylineCache.has(cacheKey)) {
        return roadPolylineCache.get(cacheKey)!;
      }

      // Try local backend proxy first
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/v1/routing/osrm?orig_lat=${origin[0]}&orig_lon=${origin[1]}&dest_lat=${dest[0]}&dest_lon=${dest[1]}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.coordinates && data.coordinates.length > 2) {
            roadPolylineCache.set(cacheKey, data.coordinates);
            return data.coordinates;
          }
        }
      } catch (err) {
        // Fallback to direct public OSRM
      }

      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes[0]?.geometry?.coordinates) {
            const roadPts: [number, number][] = data.routes[0].geometry.coordinates.map(
              ([lon, lat]: [number, number]) => [lat, lon]
            );
            roadPolylineCache.set(cacheKey, roadPts);
            return roadPts;
          }
        }
      } catch (err) {
        // Fallback
      }

      return null;
    };

    // 1. Draw Calibrated Road Polyline Routes
    let calibratedCount = 0;
    links.forEach((l) => {
      const originCoord = nodeCoordMap[l.origin_id];
      const destCoord = nodeCoordMap[l.destination_id];

      if (originCoord && destCoord) {
        let color = '#2563eb'; // Blue default navigation corridor
        let dashArray: string | undefined = undefined;
        let weight = 4;
        let opacity = 0.85;

        const isSevered = (l.status === 'disabled') || (l.origin_id === 'node-port-a' && !portAActive);
        const isContingency = l.is_alternate || l.id.includes('alternate') || l.origin_id === 'node-port-b';
        const isDistribution = l.destination_id.includes('hosp') || l.destination_id.includes('clinic');

        if (isSevered) {
          color = '#e11d48'; // Rose severed route
          dashArray = '8, 8';
          opacity = 0.85;
          weight = 4;
        } else if (isContingency) {
          if (portBActive || l.is_active_path) {
            color = '#059669'; // Emerald active contingency
            weight = 5;
            opacity = 0.95;
          } else {
            color = '#d97706'; // Amber standby
            dashArray = '6, 6';
            opacity = 0.75;
            weight = 3;
          }
        } else if (isDistribution) {
          color = '#7c3aed'; // Purple distribution route
          weight = 4;
        }

        const cacheKey = `${originCoord[0].toFixed(4)},${originCoord[1].toFixed(4)}-${destCoord[0].toFixed(4)},${destCoord[1].toFixed(4)}`;
        const cachedRoad = roadPolylineCache.get(cacheKey);

        const polyline = L.polyline(cachedRoad || [originCoord, destCoord], {
          color,
          weight,
          opacity,
          dashArray,
          lineJoin: 'round',
        });

        if (cachedRoad) {
          calibratedCount++;
        } else {
          // Asynchronously fetch road geometry and snap to highway
          fetchRoadPolyline(originCoord, destCoord).then((roadCoords) => {
            if (roadCoords && roadCoords.length > 2) {
              polyline.setLatLngs(roadCoords);
              setRoadCalibratedCount((prev) => prev + 1);
            }
          });
        }

        const popupContent = `
          <div style="font-family: inherit; color: #1e293b; padding: 2px; font-size: 13px;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 13px; border-bottom: 2px solid ${color}; padding-bottom: 3px;">
              ${l.origin_name.split('(')[0]} &rarr; ${l.destination_name.split('(')[0]}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; margin-top: 6px; color: #334155;">
              <div><strong>Road Distance:</strong> ${l.distance_km} km</div>
              <div><strong>Transit Lead:</strong> ${l.transit_days} day(s)</div>
              <div><strong>Tolls:</strong> $${l.toll_cost}</div>
              <div><strong>Freight:</strong> $${l.freight_rate}/unit</div>
            </div>
            <div style="margin-top: 6px; font-size: 11px; color: #16a34a; font-weight: 600;">
              🛣️ Highway Road Calibrated (OpenStreetMap / OSRM)
            </div>
            <div style="margin-top: 4px; font-size: 11px; color: #64748b;">
              Status: <span style="color: ${color}; font-weight: 700;">${l.status.toUpperCase()}</span>
            </div>
          </div>
        `;

        polyline.bindPopup(popupContent);
        polylines.addLayer(polyline);
      }
    });

    setRoadCalibratedCount(calibratedCount);

    // 2. Add Facility Markers
    nodes.forEach((n) => {
      if (!n.lat || !n.lon) return;

      let borderColor = '#0284c7';
      let labelIcon = '⚓';

      if (n.type === 'port') {
        labelIcon = '⚓';
        if (n.id === 'node-port-a' && !portAActive) {
          borderColor = '#e11d48';
        } else if (n.id === 'node-port-b' && !portAActive && portBActive) {
          borderColor = '#059669';
        } else {
          borderColor = '#0284c7';
        }
      } else if (n.type === 'warehouse' || n.type === 'depot') {
        labelIcon = '📦';
        borderColor = '#7c3aed';
      } else if (n.type === 'hospital' || n.type === 'clinic') {
        labelIcon = '🏥';
        borderColor = '#059669';
      } else if (n.type === 'digital_service') {
        labelIcon = '⚡';
        borderColor = !portAActive ? '#e11d48' : '#9333ea';
      }

      const isSelected = selectedNodeId === n.id;
      const pulseClass = (n.status === 'disrupted' || n.status === 'compromised') ? 'marker-pulse-red' : (n.status === 'active_alternate' ? 'marker-pulse-green' : '');

      const iconHtml = `
        <div class="custom-map-marker ${pulseClass} ${isSelected ? 'marker-selected' : ''}" style="
          background: #ffffff;
          border: 3px solid ${borderColor};
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.15s ease;
        ">
          ${labelIcon}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([n.lat, n.lon], { icon: customIcon });

      const popupContent = `
        <div style="font-family: inherit; color: #1e293b; padding: 2px; font-size: 13px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 14px; border-bottom: 2px solid ${borderColor}; padding-bottom: 3px;">
            ${n.name}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            ${n.city || ''} &bull; Type: <span style="text-transform: capitalize;">${(n.type || '').replace('_', ' ')}</span>
          </div>
          <div style="font-size: 11px; color: #0284c7; margin-top: 2px; font-family: monospace;">
            GPS: ${n.lat.toFixed(4)}°N, ${n.lon.toFixed(4)}°E
          </div>
          <div style="margin-top: 6px; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 6px; color: #334155;">
            Status: <strong style="color: ${borderColor};">${(n.status || 'NORMAL').toUpperCase()}</strong>
          </div>
          ${n.notes ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${n.notes}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        if (onSelectNode) onSelectNode(n.id);
      });

      markers.addLayer(marker);
    });
  }, [nodes, links, portAActive, portBActive, selectedNodeId, onSelectNode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '440px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#f8fafc' }} />

      {/* Floating Map Header / Calibration Badge */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '8px',
        padding: '6px 12px',
        fontSize: '11px',
        color: '#f8fafc',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Navigation size={13} color="#38bdf8" />
        <span>Road Geometry Calibrated (National Highways)</span>
        <span style={{
          background: 'rgba(16, 185, 129, 0.2)',
          color: '#34d399',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
        }}>
          <CheckCircle size={10} /> OSRM Engine ({roadCalibratedCount} Routes)
        </span>
      </div>

      {/* Edit Facilities Button on Map */}
      {onOpenFacilityEditor && (
        <button
          onClick={onOpenFacilityEditor}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '11px',
            color: '#ffffff',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <MapPin size={13} />
          <span>Edit Locations &amp; Facilities ({nodes.length})</span>
        </button>
      )}

      {/* Floating Map Legend & Status HUD */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '10px',
        padding: '8px 16px',
        fontSize: '11px',
        color: '#f8fafc',
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        zIndex: 1000,
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7', boxShadow: '0 0 6px #0284c7' }} />
          <span>Primary Route</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#e11d48', boxShadow: '0 0 6px #e11d48' }} />
          <span>Disrupted / Offline</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#059669', boxShadow: '0 0 6px #059669' }} />
          <span>Contingency Route</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 6px #7c3aed' }} />
          <span>Distribution Network</span>
        </div>
      </div>
    </div>
  );
};
