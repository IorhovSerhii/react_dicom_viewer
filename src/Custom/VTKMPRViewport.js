import React, { Component } from 'react';
import PropTypes from 'prop-types';
import VTKViewport from '../VTKViewport/VTKViewport';

import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';
import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';

class VTKMPRViewport extends Component {
  state = {
    renderWindowData: []
  };

  static defaultProps = {
    background: [0, 0, 0]
  };

  static propTypes = {
    background: PropTypes.arrayOf(PropTypes.number).isRequired,
    inputData: PropTypes.object.isRequired,
    labelMapInputData: PropTypes.object,
    focusedWidgetId: PropTypes.string,
    paintWidgetCallbacks: PropTypes.object
  };

  componentDidMount() {
    this.vtkViewportRef = React.createRef();

    const { inputData, background } = this.props;

    const volumeActor = vtkVolume.newInstance();
    const volumeMapper = vtkVolumeMapper.newInstance();

    volumeMapper.setInputData(inputData);
    volumeActor.setMapper(volumeMapper);

    const radius = 10;
    const paintWidget = vtkPaintWidget.newInstance();
    paintWidget.setRadius(radius);
    paintWidget.setColor([1, 0, 0]);

    // Paint filter
    const paintFilter = vtkPaintFilter.newInstance();

    const labelMap = {
      actor: vtkVolume.newInstance(),
      mapper: vtkVolumeMapper.newInstance(),
      cfun: vtkColorTransferFunction.newInstance(),
      ofun: vtkPiecewiseFunction.newInstance()
    };

    // labelmap pipeline
    labelMap.actor.setMapper(labelMap.mapper);
    labelMap.mapper.setInputConnection(paintFilter.getOutputPort());

    // set up labelMap color and opacity mapping
    labelMap.cfun.addRGBPoint(1, 0, 0, 1); // label "1" will be blue
    labelMap.ofun.addPoint(0, 0); // our background value, 0, will be invisible
    labelMap.ofun.addPoint(1, 1); // all values above 1 will be fully opaque

    labelMap.actor.getProperty().setRGBTransferFunction(0, labelMap.cfun);
    labelMap.actor.getProperty().setScalarOpacity(0, labelMap.ofun);

    if (this.props.labelMapInputData) {
      paintFilter.setLabelMap(this.props.labelMapInputData);
    }

    // update paint filter
    paintFilter.setBackgroundImage(inputData);
    // don't set to 0, since that's our empty label color from our pwf
    paintFilter.setLabel(1);
    paintFilter.setRadius(radius);
    // set custom threshold
    const threshold = 1;
    paintFilter.setVoxelFunc((bgValue, label, idx) => {
      return label;

      /*if (bgValue > 0) {
        return label;
      }*/

      //return null;
    });

    const interactorOnModified = interactorStyle => {
      const position = [0, 0, 0];
      const normal = interactorStyle.getSliceNormal();
      const slice = interactorStyle.getSlice();

      // Obtain position
      const origin = normal.slice();
      vtkMath.multiplyScalar(origin, slice);
      paintWidget.getManipulator().setOrigin(origin);

      // The PlaneWidget exposes a 'manipulator' which is a circle
      // displayed over the viewport. It's location is set in IJK
      // coordinates
      // paintWidget.getManipulator().setNormal(normal);

      // const handle = paintWidget.getWidgetState().getHandle();
      // handle.rotateFromDirections(handle.getDirection(), normal);
    };

    const PAINT_WIDGET_ID = 'PaintWidget';

    const paintWidgetSetup = {
      id: PAINT_WIDGET_ID,
      vtkWidget: paintWidget,
      viewType: ViewTypes.SLICE,
      callbacks: {
        onStartInteractionEvent: () => {
          paintFilter.startStroke();
          paintFilter.addPoint(paintWidget.getWidgetState().getTrueOrigin());

          if (
            this.props.paintWidgetCallbacks &&
            this.props.paintWidgetCallbacks.onStartInteractionEvent
          ) {
            this.props.paintWidgetCallbacks.onStartInteractionEvent();
          }
        },
        onInteractionEvent: widgetHandle => {
          if (widgetHandle.getPainting()) {
            paintFilter.addPoint(paintWidget.getWidgetState().getTrueOrigin());

            if (
              this.props.paintWidgetCallbacks &&
              this.props.paintWidgetCallbacks.onInteractionEvent
            ) {
              this.props.paintWidgetCallbacks.onInteractionEvent();
            }
          }
        },
        onEndInteractionEvent: () => {
          paintFilter.endStroke();

          if (
            this.props.paintWidgetCallbacks &&
            this.props.paintWidgetCallbacks.onEndInteractionEvent
          ) {
            this.props.paintWidgetCallbacks.onEndInteractionEvent();
          }
        }
      }
    };

    const renderWindowData = this.state.renderWindowData;
    renderWindowData[0] = {
      background,
      interactorStyle: {
        name: 'rotate',
        callbacks: {
          onModified: interactorOnModified
        }
      },
      vtkVolumeActors: [volumeActor, labelMap.actor],
      widgets: [paintWidgetSetup],
      focusedWidgetId: this.props.focusedWidgetId
    };

    this.setState({
      renderWindowData
    });
  }

  componentDidUpdate(prevProps) {
    if (this.props.focusedWidgetId !== prevProps.focusedWidgetId) {
      const { renderWindowData } = this.state;
      const updatedRenderWindowData = renderWindowData.slice();

      updatedRenderWindowData[0].focusedWidgetId = this.props.focusedWidgetId;

      this.setState({
        renderWindowData: updatedRenderWindowData
      });
    }
  }

  render() {
    return (
      <VTKViewport
        ref={this.vtkViewportRef}
        renderWindowData={this.state.renderWindowData}
      />
    );
  }
}

export default VTKMPRViewport;
