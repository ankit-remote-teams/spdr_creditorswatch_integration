import mongoose, { Document, Schema } from 'mongoose';
import { ITaskHourRecord, TimeInterval } from '../types/smartsheet.types';


// Define the schema for TimeInterval
const timeIntervalSchema = new Schema<TimeInterval>({
  start: {
    type: Date,
    default: null
  },
  stop: {
    type: Date,
    default: null
  }
});

// Define the schema for TaskHourRecord
const taskHourRecordSchema = new Schema<ITaskHourRecord>({
  taskId: {
    type: String,
    required: true,
    unique: true
  },
  timeIntervals: [timeIntervalSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to add a start time
taskHourRecordSchema.methods.addStartTime = function (this: ITaskHourRecord, startTime: Date): Promise<ITaskHourRecord> {
  this.timeIntervals.push({ start: startTime }); // Add a new interval with just start
  return this.save();
};

// Method to add a stop time to the latest interval
taskHourRecordSchema.methods.addStopTime = function (this: ITaskHourRecord, stopTime: Date) {
  const lastInterval = this.timeIntervals[this.timeIntervals.length - 1];

  if (lastInterval && !lastInterval.stop) {
    lastInterval.stop = stopTime; // Update the stop time of the last interval
    return this.save();
  } else {
    console.log('No active start time to stop');
  }
};

// Create the model
const SmartsheetTaskTrackingModel = mongoose.model<ITaskHourRecord>('SmartsheetTaskTracking', taskHourRecordSchema);

export default SmartsheetTaskTrackingModel;
